import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  PRACTICES_COLLECTION,
  PRACTICE_APPOINTMENTS_SUBCOLLECTION,
} from '../shared/constants';
import { getBookableBlocks, getAllSoftBlocks, getPractice } from './practiceSettingsService';
import { getPracticeDailySchedule } from './practiceCalendarService';
import { getDoctorAppointments } from './appointmentService';
import {
  normalizeConsultTypeSettings,
  resolveConsultTypeSetting,
} from '../lib/consultTypeSettings';
import type {
  AvailableSlot,
  BookableBlock,
  BookingPolicy,
  ConsultType,
  ConsultTypeSetting,
  PracticeDailySchedule,
  SoftBlock,
  Appointment,
} from '../types';



export interface SlotValidationResult {
  valid: boolean;
  reason?:
    | 'outside_bookable_block'
    | 'soft_block_conflict'
    | 'appointment_conflict'
    | 'consult_type_not_allowed'
    | 'consult_type_disabled'
    | 'consult_type_unknown'
    | 'duration_mismatch';
  softBlock?: SoftBlock;
  conflictingAppointmentId?: string;
  /** Authoritative duration resolved from appointment type (minutes). */
  resolvedDurationMinutes?: number;
  resolvedBufferMinutes?: number;
  resolvedTypeName?: string;
}



const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const dateAtTime = (date: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && aEnd > bStart;

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const advanceOccurrence = (date: Date, recurrence: SoftBlock['recurrence']): Date => {
  if (!recurrence) return date;
  const interval = Math.max(1, recurrence.interval || 1);
  if (recurrence.frequency === 'daily') return addDays(date, interval);
  if (recurrence.frequency === 'weekly') return addDays(date, 7 * interval);
  return addMonths(date, interval);
};

const expandSoftBlockForDay = (
  block: SoftBlock,
  dayStart: Date,
  dayEnd: Date
): SoftBlock[] => {
  if (!block.recurrence) {
    return overlaps(block.startAt, block.endAt, dayStart, dayEnd) ? [block] : [];
  }

  const durationMs = block.endAt.getTime() - block.startAt.getTime();
  if (durationMs <= 0) return [];

  const recurrenceEnd = block.recurrence.endDate ? endOfDay(block.recurrence.endDate) : null;
  if (recurrenceEnd && recurrenceEnd < dayStart) return [];

  const occurrences: SoftBlock[] = [];
  let cursor = new Date(block.startAt);
  let safety = 0;

  while (cursor <= dayEnd && safety < 5000) {
    if (recurrenceEnd && cursor > recurrenceEnd) break;
    const occurrenceEnd = new Date(cursor.getTime() + durationMs);

    if (overlaps(cursor, occurrenceEnd, dayStart, dayEnd)) {
      occurrences.push({
        ...block,
        startAt: new Date(cursor),
        endAt: occurrenceEnd,
      });
    }

    cursor = advanceOccurrence(cursor, block.recurrence);
    safety += 1;
  }

  return occurrences;
};

const getEffectiveSoftBlocksForDay = (
  allSoftBlocks: SoftBlock[],
  dayStart: Date,
  dayEnd: Date
): SoftBlock[] =>
  allSoftBlocks.flatMap((block) => expandSoftBlockForDay(block, dayStart, dayEnd));



export type GenerateRawSlotsOptions = {
  /** When set, slots are generated using this type's authoritative duration/buffer. */
  consultType?: ConsultType;
  /** Practice consultTypeSettings (normalized). Legacy falls back to block duration. */
  typeSettings?: ConsultTypeSetting[] | null;
  /** Legacy enabled allow-list used only when typeSettings is empty. */
  legacyEnabledTypes?: ConsultType[] | null;
};

export const generateRawSlots = (
  date: Date,
  blocks: BookableBlock[],
  dailySchedule?: PracticeDailySchedule | null,
  options?: GenerateRawSlotsOptions,
): AvailableSlot[] => {
  if (dailySchedule?.availability === 'closed') {
    return [];
  }

  const effectiveBlocks = applyDailyScheduleToBlocks(blocks, date, dailySchedule);
  const dow = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const slots: AvailableSlot[] = [];
  const consultType = options?.consultType;

  let typeDuration: number | null = null;
  let typeBuffer: number | null = null;

  if (consultType) {
    const setting = resolveConsultTypeSetting(
      options?.typeSettings,
      consultType,
      options?.legacyEnabledTypes,
    );
    if (!setting || !setting.enabled) {
      return [];
    }
    typeDuration = setting.durationMinutes;
    typeBuffer = setting.bufferMinutes;
  }

  for (const block of effectiveBlocks) {
    if (block.dayOfWeek !== dow || !block.active) continue;
    // When an appointment type supplies duration, the block is a time window only.
    if (
      consultType &&
      typeDuration == null &&
      !block.allowedConsultTypes.includes(consultType)
    ) {
      continue;
    }

    const durationMinutes = typeDuration ?? block.slotDurationMinutes;
    const bufferAfterMinutes = typeBuffer ?? block.bufferAfterMinutes;
    const blockStart = toMinutes(block.startTime);
    const blockEnd = toMinutes(block.endTime);
    const step = durationMinutes + bufferAfterMinutes;

    let cursor = blockStart + block.bufferBeforeMinutes;
    while (cursor + durationMinutes <= blockEnd) {
      const hh = Math.floor(cursor / 60)
        .toString()
        .padStart(2, '0');
      const mm = (cursor % 60).toString().padStart(2, '0');
      const slotStart = dateAtTime(date, `${hh}:${mm}`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      slots.push({
        startAt: slotStart,
        endAt: slotEnd,
        locationId: block.locationId,
        consultTypes: consultType ? [consultType] : block.allowedConsultTypes,
        bookableBlockId: block.id,
      });
      cursor += step;
    }
  }

  return slots;
};

/** Clip or clear weekly blocks for a one-off daily exception. */
export const applyDailyScheduleToBlocks = (
  blocks: BookableBlock[],
  date: Date,
  dailySchedule?: PracticeDailySchedule | null,
): BookableBlock[] => {
  if (!dailySchedule) return blocks;
  if (dailySchedule.availability === 'closed') return [];
  if (dailySchedule.availability === 'open') return blocks;
  if (
    dailySchedule.availability === 'limited' &&
    dailySchedule.openTime &&
    dailySchedule.closeTime
  ) {
    const open = toMinutes(dailySchedule.openTime);
    const close = toMinutes(dailySchedule.closeTime);
    return blocks
      .map((block) => {
        const start = Math.max(toMinutes(block.startTime), open);
        const end = Math.min(toMinutes(block.endTime), close);
        if (end <= start) return null;
        return {
          ...block,
          startTime: `${Math.floor(start / 60)
            .toString()
            .padStart(2, '0')}:${(start % 60).toString().padStart(2, '0')}`,
          endTime: `${Math.floor(end / 60)
            .toString()
            .padStart(2, '0')}:${(end % 60).toString().padStart(2, '0')}`,
        };
      })
      .filter((b): b is BookableBlock => b != null);
  }
  return blocks;
};

export const getAvailableSlots = async (
  practiceId: string,
  doctorId: string,
  date: Date,
  consultType?: ConsultType
): Promise<AvailableSlot[]> => {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [blocks, allSoftBlocks, appointments, dailySchedule, practice] =
    await Promise.all([
      getBookableBlocks(practiceId),
      getAllSoftBlocks(practiceId),
      getDoctorAppointments(doctorId),
      getPracticeDailySchedule(
        practiceId,
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      ),
      getPractice(practiceId),
    ]);

  const typeSettings = normalizeConsultTypeSettings(
    practice?.consultTypeSettings,
    practice?.consultTypes,
  );

  if (consultType) {
    const setting = resolveConsultTypeSetting(
      typeSettings,
      consultType,
      practice?.consultTypes,
    );
    if (!setting || !setting.enabled) {
      return [];
    }
  }

  const doctorBlocks = blocks.filter((b) => b.doctorId === doctorId);
  const softBlocks = getEffectiveSoftBlocksForDay(
    allSoftBlocks.filter((b) => b.doctorId === doctorId),
    dayStart,
    dayEnd
  );
  const raw = generateRawSlots(date, doctorBlocks, dailySchedule, {
    consultType,
    typeSettings,
    legacyEnabledTypes: practice?.consultTypes,
  });

  const dayAppointments = appointments.filter((a) => {
    const aptDate = a.startAt ?? a.date;
    return (
      aptDate >= dayStart &&
      aptDate <= dayEnd &&
      a.status !== 'cancelled'
    );
  });

  return raw.filter((slot) => {
    if (consultType && !slot.consultTypes.includes(consultType)) return false;

    const hitsSoftBlock = softBlocks.some((sb) =>
      overlaps(slot.startAt, slot.endAt, sb.startAt, sb.endAt)
    );
    if (hitsSoftBlock) return false;

    const hitsAppointment = dayAppointments.some((a) => {
      const aptStart = a.startAt ?? a.date;
      const durationMs =
        typeof a.durationMinutes === 'number' && a.durationMinutes > 0
          ? a.durationMinutes * 60_000
          : 30 * 60_000;
      const aptEnd = a.endAt ?? new Date(aptStart.getTime() + durationMs);
      return overlaps(slot.startAt, slot.endAt, aptStart, aptEnd);
    });
    return !hitsAppointment;
  });
};



export const validateSlot = async (
  practiceId: string,
  doctorId: string,
  startAt: Date,
  endAt: Date,
  consultType: ConsultType,
  excludeAppointmentId?: string
): Promise<SlotValidationResult> => {
  const dayStart = startOfDay(startAt);
  const dayEnd = endOfDay(startAt);

  const [blocks, allSoftBlocks, appointments, dailySchedule, practice] =
    await Promise.all([
      getBookableBlocks(practiceId),
      getAllSoftBlocks(practiceId),
      getDoctorAppointments(doctorId),
      getPracticeDailySchedule(
        practiceId,
        `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, '0')}-${String(startAt.getDate()).padStart(2, '0')}`,
      ),
      getPractice(practiceId),
    ]);

  const typeSettings = normalizeConsultTypeSettings(
    practice?.consultTypeSettings,
    practice?.consultTypes,
  );
  const setting = resolveConsultTypeSetting(
    typeSettings,
    consultType,
    practice?.consultTypes,
  );
  if (!setting) {
    return { valid: false, reason: 'consult_type_unknown' };
  }
  if (!setting.enabled) {
    return { valid: false, reason: 'consult_type_disabled' };
  }

  const expectedEnd = new Date(
    startAt.getTime() + setting.durationMinutes * 60_000,
  );
  // Client-supplied endAt must match authoritative duration (allow 1 min skew).
  if (Math.abs(expectedEnd.getTime() - endAt.getTime()) > 60_000) {
    return {
      valid: false,
      reason: 'duration_mismatch',
      resolvedDurationMinutes: setting.durationMinutes,
      resolvedBufferMinutes: setting.bufferMinutes,
      resolvedTypeName: setting.name,
    };
  }

  const doctorBlocks = blocks.filter((b) => b.doctorId === doctorId);
  if (dailySchedule?.availability === 'closed') {
    return { valid: false, reason: 'outside_bookable_block' };
  }
  const effectiveBlocks = applyDailyScheduleToBlocks(
    doctorBlocks,
    startAt,
    dailySchedule,
  );
  const softBlocks = getEffectiveSoftBlocksForDay(
    allSoftBlocks.filter((b) => b.doctorId === doctorId),
    dayStart,
    dayEnd
  );
  const dow = startAt.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const slotStartMin = startAt.getHours() * 60 + startAt.getMinutes();
  const slotEndMin = slotStartMin + setting.durationMinutes;

  // Doctor-side create with empty schedule remains allowed.
  if (effectiveBlocks.length > 0 || doctorBlocks.length > 0) {
    const matchingBlock = effectiveBlocks.find((b) => {
      if (b.dayOfWeek !== dow || !b.active) return false;
      const blockStart = toMinutes(b.startTime);
      const blockEnd = toMinutes(b.endTime);
      return slotStartMin >= blockStart && slotEndMin <= blockEnd;
    });

    if (!matchingBlock) {
      return { valid: false, reason: 'outside_bookable_block' };
    }
  }

  const hitSoftBlock = softBlocks.find((sb) =>
    overlaps(startAt, expectedEnd, sb.startAt, sb.endAt)
  );
  if (hitSoftBlock) {
    return { valid: false, reason: 'soft_block_conflict', softBlock: hitSoftBlock };
  }

  const conflicting = appointments.find((a) => {
    if (a.id === excludeAppointmentId) return false;
    if (a.status === 'cancelled') return false;
    const aptStart = a.startAt ?? a.date;
    const durationMs =
      typeof a.durationMinutes === 'number' && a.durationMinutes > 0
        ? a.durationMinutes * 60_000
        : 30 * 60_000;
    const aptEnd = a.endAt ?? new Date(aptStart.getTime() + durationMs);
    return overlaps(startAt, expectedEnd, aptStart, aptEnd);
  });
  if (conflicting) {
    return {
      valid: false,
      reason: 'appointment_conflict',
      conflictingAppointmentId: conflicting.id,
    };
  }

  return {
    valid: true,
    resolvedDurationMinutes: setting.durationMinutes,
    resolvedBufferMinutes: setting.bufferMinutes,
    resolvedTypeName: setting.name,
  };
};



export interface CancellationCheck {
  allowed: boolean;
  reason?: string;
}

export const checkCancellationPolicy = (
  appointment: Appointment,
  cancelledByRole: 'patient' | 'doctor' | 'delegate',
  policy: BookingPolicy
): CancellationCheck => {
  const now = new Date();
  const aptDate = appointment.startAt ?? appointment.date;
  const hoursUntilAppointment = (aptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (cancelledByRole === 'patient') {
    if (hoursUntilAppointment < policy.patientCancellationWindowHours) {
      return {
        allowed: false,
        reason: `Cancellations require at least ${policy.patientCancellationWindowHours} hours notice. ${policy.noShowPolicyText}`,
      };
    }
  } else {
    if (hoursUntilAppointment < policy.doctorCancellationWindowHours) {
      return {
        allowed: false,
        reason: `Practice cancellations require at least ${policy.doctorCancellationWindowHours} hour notice.`,
      };
    }
  }

  return { allowed: true };
};



export interface ScheduledAppointmentData {
  appointmentId?: string;
  practiceId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  consultType: ConsultType;
  locationId: string;
  startAt: Date;
  /** Optional — server recomputes from appointment type when validating. */
  endAt?: Date;
  notes?: string;
  status?: Appointment['status'];
  requestedByRole: 'patient' | 'doctor' | 'delegate';
  overrideApplied: boolean;
  conflictMeta?: { softBlockId?: string; appointmentId?: string; reason?: string };
}

/**
 * Authoritative booking path: resolves duration/buffer from practice appointment types,
 * validates the slot, then persists snapshots for historical integrity.
 */
export const createScheduledAppointment = async (
  data: ScheduledAppointmentData
): Promise<string> => {
  const practice = await getPractice(data.practiceId);
  const settings = normalizeConsultTypeSettings(
    practice?.consultTypeSettings,
    practice?.consultTypes,
  );
  const setting = resolveConsultTypeSetting(
    settings,
    data.consultType,
    practice?.consultTypes,
  );
  if (!setting || !setting.enabled) {
    throw new Error('This appointment type is not available for booking.');
  }

  const authoritativeEnd = new Date(
    data.startAt.getTime() + setting.durationMinutes * 60_000,
  );

  // Patients/delegates cannot override duration. Doctors may override conflicts only.
  if (data.requestedByRole === 'patient' || !data.overrideApplied) {
    const validation = await validateSlot(
      data.practiceId,
      data.doctorId,
      data.startAt,
      authoritativeEnd,
      data.consultType,
      data.appointmentId,
    );
    if (!validation.valid) {
      throw new Error(
        validation.reason === 'consult_type_disabled'
          ? 'This appointment type is disabled.'
          : validation.reason === 'duration_mismatch'
            ? 'Appointment duration does not match the selected type.'
            : validation.reason === 'outside_bookable_block'
              ? 'Selected time is outside doctor availability.'
              : validation.reason === 'soft_block_conflict'
                ? 'Selected time conflicts with blocked time.'
                : validation.reason === 'appointment_conflict'
                  ? 'Selected time is already booked.'
                  : 'Selected time is not available.',
      );
    }
  }

  const payload = {
    doctorId: data.doctorId,
    patientId: data.patientId,
    patientName: data.patientName,
    patientEmail: data.patientEmail,
    consultType: data.consultType,
    appointmentTypeName: setting.name,
    locationId: data.locationId,
    startAt: Timestamp.fromDate(data.startAt),
    endAt: Timestamp.fromDate(authoritativeEnd),
    durationMinutes: setting.durationMinutes,
    bufferMinutes: setting.bufferMinutes,
    notes: data.notes ?? '',
    status: data.status ?? 'pending',
    requestedByRole: data.requestedByRole,
    overrideApplied: data.overrideApplied,
    conflictMeta: data.conflictMeta ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (data.appointmentId) {
    const scheduledRef = doc(
      db,
      PRACTICES_COLLECTION,
      data.practiceId,
      PRACTICE_APPOINTMENTS_SUBCOLLECTION,
      data.appointmentId
    );
    await setDoc(scheduledRef, payload, { merge: true });
    return data.appointmentId;
  }

  const ref = collection(
    db,
    PRACTICES_COLLECTION,
    data.practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION
  );
  const docRef = await addDoc(ref, payload);
  return docRef.id;
};

export const updateScheduledAppointmentStatus = async (
  practiceId: string,
  appointmentId: string,
  status: Appointment['status'],
  options?: { doctorId?: string; patientId?: string; startAt?: Date }
): Promise<void> => {
  const targetRef = doc(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION,
    appointmentId
  );
  const targetSnap = await getDoc(targetRef);

  if (targetSnap.exists()) {
    await updateDoc(targetRef, { status, updatedAt: serverTimestamp() });
    return;
  }

  // Fallback for legacy records where practice appointment ID differs from global appointment ID.
  if (!options?.doctorId) return;

  const ref = collection(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION
  );
  const snap = await getDocs(query(ref, where('doctorId', '==', options.doctorId)));

  const candidates = snap.docs.filter((d) => {
    const data = d.data();
    if (options.patientId && data.patientId !== options.patientId) return false;
    return true;
  });

  if (candidates.length === 0) return;

  let bestMatch = candidates[0];
  if (options.startAt) {
    const targetTime = options.startAt.getTime();
    bestMatch = candidates.reduce((best, current) => {
      const bestTime = best.data().startAt instanceof Timestamp ? best.data().startAt.toDate().getTime() : 0;
      const currentTime =
        current.data().startAt instanceof Timestamp ? current.data().startAt.toDate().getTime() : 0;
      return Math.abs(currentTime - targetTime) < Math.abs(bestTime - targetTime) ? current : best;
    }, candidates[0]);
  }

  await updateDoc(bestMatch.ref, { status, updatedAt: serverTimestamp() });
};

export const getAllPracticeAppointments = async (practiceId: string): Promise<any[]> => {
  const ref = collection(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION
  );
  const snap = await getDocs(ref);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      startAt: data.startAt instanceof Timestamp ? data.startAt.toDate() : data.startAt,
      endAt: data.endAt instanceof Timestamp ? data.endAt.toDate() : data.endAt,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
      date: data.startAt instanceof Timestamp ? data.startAt.toDate() : data.date,
    };
  });
};

export const getPracticeAppointments = async (
  practiceId: string,
  doctorId: string
): Promise<any[]> => {
  const ref = collection(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION
  );
  const snap = await getDocs(query(ref, where('doctorId', '==', doctorId)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      startAt: data.startAt instanceof Timestamp ? data.startAt.toDate() : data.startAt,
      endAt: data.endAt instanceof Timestamp ? data.endAt.toDate() : data.endAt,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
    };
  });
};
