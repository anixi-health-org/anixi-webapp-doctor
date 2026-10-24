import { getBookableBlocks, getAllSoftBlocks, getPractice } from './practiceSettingsService';
import {
  djangoBookAppointment,
  djangoListAppointments,
  djangoPatchAppointment,
} from './djangoApiService';
import { getPracticeDailySchedule } from './practiceCalendarService';
import { getDoctorAppointments } from './appointmentService';
import {
  normalizeConsultTypeSettings,
  resolveConsultTypeSetting,
} from '../lib/consultTypeSettings';
import { isValidTimeZone, zonedDayTime, zonedParts } from '../lib/zonedTime';
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
  /** Practice timezone. Block hours are clinic wall-clock times, not the browser's. */
  timeZone?: string | null;
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
  const zone = isValidTimeZone(options?.timeZone) ? options?.timeZone : null;

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
      const slotStart = zone
        ? zonedDayTime(date, `${hh}:${mm}`, zone)
        : dateAtTime(date, `${hh}:${mm}`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      slots.push({
        startAt: slotStart,
        endAt: slotEnd,
        locationId: block.locationId,
        consultTypes: consultType ? [consultType] : block.allowedConsultTypes,
        bookableBlockId: block.id,
        ...(zone ? { timeZone: zone } : {}),
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
  consultType?: ConsultType,
  options?: { excludeAppointmentId?: string },
): Promise<AvailableSlot[]> => {
  const [blocks, allSoftBlocks, appointments, dailySchedule, practice] =
    await Promise.all([
      getBookableBlocks(practiceId),
      getAllSoftBlocks(practiceId),
      getDoctorAppointments(doctorId, practiceId),
      getPracticeDailySchedule(
        practiceId,
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      ),
      getPractice(practiceId),
    ]);

  const zone = isValidTimeZone(practice?.timezone) ? practice?.timezone : null;
  const dayStart = zone ? zonedDayTime(date, '00:00', zone) : startOfDay(date);
  const dayEnd = zone
    ? new Date(zonedDayTime(addDays(date, 1), '00:00', zone).getTime() - 1)
    : endOfDay(date);

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
    timeZone: zone,
  });

  const dayAppointments = appointments.filter((a) => {
    if (options?.excludeAppointmentId && a.id === options.excludeAppointmentId) return false;
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
  // Block hours are clinic wall-clock times: read the slot on the practice's clock.
  const practice = await getPractice(practiceId);
  const zone = isValidTimeZone(practice?.timezone) ? practice?.timezone : null;
  const local = zone
    ? zonedParts(startAt, zone)
    : {
        year: startAt.getFullYear(),
        month: startAt.getMonth(),
        day: startAt.getDate(),
        hour: startAt.getHours(),
        minute: startAt.getMinutes(),
        weekday: startAt.getDay(),
      };
  const calendarDay = new Date(local.year, local.month, local.day);
  const dayStart = zone ? zonedDayTime(calendarDay, '00:00', zone) : startOfDay(startAt);
  const dayEnd = zone
    ? new Date(zonedDayTime(addDays(calendarDay, 1), '00:00', zone).getTime() - 1)
    : endOfDay(startAt);

  const [blocks, allSoftBlocks, appointments, dailySchedule] = await Promise.all([
    getBookableBlocks(practiceId),
    getAllSoftBlocks(practiceId),
    getDoctorAppointments(doctorId, practiceId),
    getPracticeDailySchedule(
      practiceId,
      `${local.year}-${String(local.month + 1).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`,
    ),
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
    calendarDay,
    dailySchedule,
  );
  const softBlocks = getEffectiveSoftBlocksForDay(
    allSoftBlocks.filter((b) => b.doctorId === doctorId),
    dayStart,
    dayEnd
  );
  const dow = local.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const slotStartMin = local.hour * 60 + local.minute;
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
  /** Optional, server recomputes from appointment type when validating. */
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

  if (data.appointmentId) {
    await djangoPatchAppointment(data.appointmentId, {
      notes: data.notes ?? '',
      status: data.status ?? 'pending',
    });
    return data.appointmentId;
  }

  const booked = await djangoBookAppointment({
    doctorId: data.doctorId,
    patientId: data.patientId,
    patientName: data.patientName,
    patientEmail: data.patientEmail,
    consultType: data.consultType,
    locationId: data.locationId,
    startAt: data.startAt.toISOString(),
    durationMinutes: setting.durationMinutes,
    status: data.status ?? 'pending',
    // The API refuses double-bookings; staff with override permission may bypass on purpose.
    ...(data.overrideApplied ? { overrideConflicts: true } : {}),
  });
  return booked.appointmentId;
};

export const updateScheduledAppointmentStatus = async (
  _practiceId: string,
  appointmentId: string,
  status: Appointment['status'],
  _options?: { doctorId?: string; patientId?: string; startAt?: Date },
): Promise<void> => {
  await djangoPatchAppointment(appointmentId, { status });
};

const mapDjangoAppointment = (row: Record<string, unknown>) => {
  const startAt = row.startAt ? new Date(String(row.startAt)) : undefined;
  const endAt = row.endAt ? new Date(String(row.endAt)) : undefined;
  return {
    id: String(row.id),
    ...row,
    startAt,
    endAt,
    date: startAt,
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : undefined,
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : undefined,
  };
};

export const getAllPracticeAppointments = async (_practiceId: string): Promise<any[]> => {
  const rows = await djangoListAppointments('doctor');
  return rows.map((row) => mapDjangoAppointment(row as Record<string, unknown>));
};

export const getPracticeAppointments = async (
  _practiceId: string,
  doctorId: string,
): Promise<any[]> => {
  const rows = await djangoListAppointments('doctor');
  return rows
    .filter((row) => String((row as Record<string, unknown>).doctorId) === doctorId)
    .map((row) => mapDjangoAppointment(row as Record<string, unknown>));
};
