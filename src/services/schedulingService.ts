import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  PRACTICES_COLLECTION,
  PRACTICE_APPOINTMENTS_SUBCOLLECTION,
} from '../shared/constants';
import { getBookableBlocks, getSoftBlocks } from './practiceSettingsService';
import { getDoctorAppointments } from './appointmentService';
import type {
  AvailableSlot,
  BookableBlock,
  BookingPolicy,
  ConsultType,
  SoftBlock,
  Appointment,
} from '../types';

// ─── Conflict validation result ───────────────────────────────────────────────

export interface SlotValidationResult {
  valid: boolean;
  reason?: 'outside_bookable_block' | 'soft_block_conflict' | 'appointment_conflict' | 'consult_type_not_allowed';
  softBlock?: SoftBlock;
  conflictingAppointmentId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Slot generation ──────────────────────────────────────────────────────────

/**
 * Generate all available slot windows for a given date based on bookable blocks.
 * Does NOT filter out conflicts — call validateSlot separately.
 */
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

/**
 * Get available (conflict-free) slots for a given date.
 * Filters out any window that overlaps a soft block or existing appointment.
 */
export const getAvailableSlots = async (
  practiceId: string,
  doctorId: string,
  date: Date,
  consultType?: ConsultType
): Promise<AvailableSlot[]> => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [blocks, softBlocks, appointments] = await Promise.all([
    getBookableBlocks(practiceId),
    getSoftBlocks(practiceId, dayStart, dayEnd),
    getDoctorAppointments(doctorId),
  ]);

  const doctorBlocks = blocks.filter((b) => b.doctorId === doctorId);
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
    // Consult type filter
    if (consultType && !slot.consultTypes.includes(consultType)) return false;
    // Soft block conflict
    const hitsSoftBlock = softBlocks.some((sb) =>
      overlaps(slot.startAt, slot.endAt, sb.startAt, sb.endAt)
    );
    if (hitsSoftBlock) return false;
    // Appointment conflict
    const hitsAppointment = dayAppointments.some((a) => {
      const aptStart = a.startAt ?? a.date;
      const aptEnd = a.endAt ?? new Date(aptStart.getTime() + 30 * 60_000);
      return overlaps(slot.startAt, slot.endAt, aptStart, aptEnd);
    });
    return !hitsAppointment;
  });
};

// ─── Single slot validation ───────────────────────────────────────────────────

export const validateSlot = async (
  practiceId: string,
  doctorId: string,
  startAt: Date,
  endAt: Date,
  consultType: ConsultType,
  excludeAppointmentId?: string
): Promise<SlotValidationResult> => {
  const dayStart = new Date(startAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startAt);
  dayEnd.setHours(23, 59, 59, 999);

  const [blocks, softBlocks, appointments] = await Promise.all([
    getBookableBlocks(practiceId),
    getSoftBlocks(practiceId, dayStart, dayEnd),
    getDoctorAppointments(doctorId),
  ]);

  const doctorBlocks = blocks.filter((b) => b.doctorId === doctorId);
  const dow = startAt.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const slotStartMin = startAt.getHours() * 60 + startAt.getMinutes();
  const slotEndMin = endAt.getHours() * 60 + endAt.getMinutes();

  // 1. Must be inside a bookable block
  const matchingBlock = doctorBlocks.find((b) => {
    if (b.dayOfWeek !== dow || !b.active) return false;
    const bStart = toMinutes(b.startTime);
    const bEnd = toMinutes(b.endTime);
    return slotStartMin >= bStart && slotEndMin <= bEnd;
  });

  if (!matchingBlock) {
    return { valid: false, reason: 'outside_bookable_block' };
  }

  // 2. Consult type allowed
  if (!matchingBlock.allowedConsultTypes.includes(consultType)) {
    return { valid: false, reason: 'consult_type_not_allowed' };
  }

  // 3. Soft block conflict
  const hitSoftBlock = softBlocks.find((sb) =>
    overlaps(startAt, endAt, sb.startAt, sb.endAt)
  );
  if (hitSoftBlock) {
    return { valid: false, reason: 'soft_block_conflict', softBlock: hitSoftBlock };
  }

  // 4. Appointment conflict
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

// ─── Cancellation policy check ────────────────────────────────────────────────

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

// ─── Practice-scoped appointment creation ─────────────────────────────────────

export interface ScheduledAppointmentData {
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
  requestedByRole: 'patient' | 'doctor' | 'delegate';
  overrideApplied: boolean;
  conflictMeta?: { softBlockId?: string; appointmentId?: string; reason?: string };
}

export const createScheduledAppointment = async (
  data: ScheduledAppointmentData
): Promise<string> => {
  const ref = collection(
    db,
    PRACTICES_COLLECTION,
    data.practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION
  );
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
    status: 'pending',
    requestedByRole: data.requestedByRole,
    overrideApplied: data.overrideApplied,
    conflictMeta: data.conflictMeta ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  return docRef.id;
};

export const updateScheduledAppointmentStatus = async (
  practiceId: string,
  appointmentId: string,
  status: Appointment['status']
): Promise<void> => {
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_APPOINTMENTS_SUBCOLLECTION, appointmentId),
    { status, updatedAt: serverTimestamp() }
  );
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
