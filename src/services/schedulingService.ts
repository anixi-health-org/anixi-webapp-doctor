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
import { getBookableBlocks, getAllSoftBlocks } from './practiceSettingsService';
import { getDoctorAppointments } from './appointmentService';
import type {
  AvailableSlot,
  BookableBlock,
  BookingPolicy,
  ConsultType,
  SoftBlock,
  Appointment,
} from '../types';



export interface SlotValidationResult {
  valid: boolean;
  reason?: 'outside_bookable_block' | 'soft_block_conflict' | 'appointment_conflict' | 'consult_type_not_allowed';
  softBlock?: SoftBlock;
  conflictingAppointmentId?: string;
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



export const generateRawSlots = (
  date: Date,
  blocks: BookableBlock[]
): AvailableSlot[] => {
  const dow = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const slots: AvailableSlot[] = [];

  for (const block of blocks) {
    if (block.dayOfWeek !== dow || !block.active) continue;

    const blockStart = toMinutes(block.startTime);
    const blockEnd = toMinutes(block.endTime);
    const step = block.slotDurationMinutes + block.bufferAfterMinutes;

    let cursor = blockStart + block.bufferBeforeMinutes;
    while (cursor + block.slotDurationMinutes <= blockEnd) {
      const slotStart = dateAtTime(date, `${Math.floor(cursor / 60).toString().padStart(2, '0')}:${(cursor % 60).toString().padStart(2, '0')}`);
      const slotEnd = new Date(slotStart.getTime() + block.slotDurationMinutes * 60_000);
      slots.push({
        startAt: slotStart,
        endAt: slotEnd,
        locationId: block.locationId,
        consultTypes: block.allowedConsultTypes,
        bookableBlockId: block.id,
      });
      cursor += step;
    }
  }

  return slots;
};

export const getAvailableSlots = async (
  practiceId: string,
  doctorId: string,
  date: Date,
  consultType?: ConsultType
): Promise<AvailableSlot[]> => {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [blocks, allSoftBlocks, appointments] = await Promise.all([
    getBookableBlocks(practiceId),
    getAllSoftBlocks(practiceId),
    getDoctorAppointments(doctorId),
  ]);

  const doctorBlocks = blocks.filter((b) => b.doctorId === doctorId);
  const softBlocks = getEffectiveSoftBlocksForDay(
    allSoftBlocks.filter((b) => b.doctorId === doctorId),
    dayStart,
    dayEnd
  );
  const raw = generateRawSlots(date, doctorBlocks);

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
      const aptEnd = a.endAt ?? new Date(aptStart.getTime() + 30 * 60_000);
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

  const [blocks, allSoftBlocks, appointments] = await Promise.all([
    getBookableBlocks(practiceId),
    getAllSoftBlocks(practiceId),
    getDoctorAppointments(doctorId),
  ]);

  const doctorBlocks = blocks.filter((b) => b.doctorId === doctorId);
  const softBlocks = getEffectiveSoftBlocksForDay(
    allSoftBlocks.filter((b) => b.doctorId === doctorId),
    dayStart,
    dayEnd
  );
  const dow = startAt.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const slotStartMin = startAt.getHours() * 60 + startAt.getMinutes();
  const slotEndMin = endAt.getHours() * 60 + endAt.getMinutes();

  
  const matchingBlock = doctorBlocks.find((b) => {
    if (b.dayOfWeek !== dow || !b.active) return false;
    const bStart = toMinutes(b.startTime);
    const bEnd = toMinutes(b.endTime);
    return slotStartMin >= bStart && slotEndMin <= bEnd;
  });

  if (!matchingBlock) {
    return { valid: false, reason: 'outside_bookable_block' };
  }

  
  if (!matchingBlock.allowedConsultTypes.includes(consultType)) {
    return { valid: false, reason: 'consult_type_not_allowed' };
  }

  
  const hitSoftBlock = softBlocks.find((sb) =>
    overlaps(startAt, endAt, sb.startAt, sb.endAt)
  );
  if (hitSoftBlock) {
    return { valid: false, reason: 'soft_block_conflict', softBlock: hitSoftBlock };
  }

  
  const conflicting = appointments.find((a) => {
    if (a.id === excludeAppointmentId) return false;
    if (a.status === 'cancelled') return false;
    const aptStart = a.startAt ?? a.date;
    const aptEnd = a.endAt ?? new Date(aptStart.getTime() + 30 * 60_000);
    return overlaps(startAt, endAt, aptStart, aptEnd);
  });
  if (conflicting) {
    return { valid: false, reason: 'appointment_conflict', conflictingAppointmentId: conflicting.id };
  }

  return { valid: true };
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
  endAt: Date;
  notes?: string;
  status?: Appointment['status'];
  requestedByRole: 'patient' | 'doctor' | 'delegate';
  overrideApplied: boolean;
  conflictMeta?: { softBlockId?: string; appointmentId?: string; reason?: string };
}

export const createScheduledAppointment = async (
  data: ScheduledAppointmentData
): Promise<string> => {
  const payload = {
    doctorId: data.doctorId,
    patientId: data.patientId,
    patientName: data.patientName,
    patientEmail: data.patientEmail,
    consultType: data.consultType,
    locationId: data.locationId,
    startAt: Timestamp.fromDate(data.startAt),
    endAt: Timestamp.fromDate(data.endAt),
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
