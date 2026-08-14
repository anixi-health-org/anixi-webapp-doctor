/**
 * Canonical appointment identity and time model.
 *
 * One appointment has three copies that must share the same document ID:
 *   appointments/{appointmentId}
 *   Users/{patientId}/appointments/{appointmentId}
 *   Users/{doctorId}/appointments/{appointmentId}
 *
 * scheduledAt (Firestore Timestamp / Date) is the source of truth for when
 * the visit occurs. Display strings such as "10:00 AM" are derived only.
 */

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'rescheduled',
  'cancelled',
  'no_show',
  'completed',
  'auto_cancelled',
] as const;

export type CanonicalAppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const STATUS_ALIASES: Record<string, CanonicalAppointmentStatus> = {
  confirmed: 'confirmed',
  pending: 'pending',
  completed: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  rescheduled: 'rescheduled',
  no_show: 'no_show',
  noshow: 'no_show',
  auto_cancelled: 'auto_cancelled',
  auto_canceled: 'auto_cancelled',
  // Legacy alias for an unconfirmed request. Not used for unknown values.
  scheduled: 'pending',
};

export function parseAppointmentStatus(
  status: unknown
): CanonicalAppointmentStatus | null {
  if (status == null || status === '') {
    console.error('[appointment.status] missing status — not coercing to pending');
    return null;
  }

  const key = String(status).trim().toLowerCase().replace(/-/g, '_');
  const parsed = STATUS_ALIASES[key];
  if (!parsed) {
    console.error(
      '[appointment.status] unknown status — not coercing to pending',
      status
    );
    return null;
  }
  return parsed;
}

export function assertAppointmentStatus(
  status: unknown
): CanonicalAppointmentStatus {
  const parsed = parseAppointmentStatus(status);
  if (!parsed) {
    throw new Error(
      `Unknown appointment status "${String(status)}". Refusing to write a guessed state.`
    );
  }
  return parsed;
}

type AppointmentEditMeta = {
  status?: CanonicalAppointmentStatus | string | null;
  editScope?: 'slot' | 'visit_type' | string | null;
  requiresConfirmation?: boolean | null;
  confirmedScheduledAt?: unknown;
  scheduledAt?: unknown;
  date?: unknown;
  time?: unknown;
};

/**
 * Patient corrected visit type (clinic → video) without moving the slot.
 * Matches mobile: those visits stay confirmed and do not need re-approval.
 */
export function isTypeOnlyPatientEdit(appointment: AppointmentEditMeta): boolean {
  if (appointment.editScope === 'slot' || appointment.requiresConfirmation === true) {
    return false;
  }
  if (
    appointment.editScope === 'visit_type' ||
    appointment.requiresConfirmation === false
  ) {
    return true;
  }

  if (appointment.status !== 'rescheduled') return false;

  const baseline = toDate(appointment.confirmedScheduledAt);
  if (!baseline) {
    // Legacy type-only edits were stored as `rescheduled` without a baseline.
    return true;
  }

  const current = resolveScheduledAt({
    scheduledAt: appointment.scheduledAt,
    date: appointment.date,
    time: appointment.time,
  });
  if (!current) return true;

  baseline.setSeconds(0, 0);
  current.setSeconds(0, 0);
  return baseline.getTime() === current.getTime();
}

/** Status shown in doctor UI after normalizing type-only corrections. */
export function effectiveAppointmentStatus(
  appointment: AppointmentEditMeta
): CanonicalAppointmentStatus | null {
  const parsed = parseAppointmentStatus(appointment.status);
  if (!parsed) return null;
  if (parsed === 'rescheduled' && isTypeOnlyPatientEdit(appointment)) {
    return 'confirmed';
  }
  return parsed;
}

export function needsDoctorConfirmation(
  statusOrAppointment:
    | CanonicalAppointmentStatus
    | string
    | null
    | undefined
    | AppointmentEditMeta
): boolean {
  if (statusOrAppointment && typeof statusOrAppointment === 'object') {
    const effective = effectiveAppointmentStatus(statusOrAppointment);
    return effective === 'pending' || effective === 'rescheduled';
  }
  return statusOrAppointment === 'pending' || statusOrAppointment === 'rescheduled';
}

export function isTerminalAppointmentStatus(
  status: CanonicalAppointmentStatus | string | null | undefined
): boolean {
  return (
    status === 'cancelled' ||
    status === 'auto_cancelled' ||
    status === 'completed' ||
    status === 'no_show'
  );
}

export function canAutoCancelStatus(
  status: CanonicalAppointmentStatus | string | null | undefined
): boolean {
  return status === 'pending' || status === 'rescheduled';
}

/** Confirmed visits that were never started can become no-shows after the slot ends. */
export function canAutoNoShowStatus(
  status: CanonicalAppointmentStatus | string | null | undefined
): boolean {
  return status === 'confirmed';
}

const DEFAULT_SLOT_DURATION_MINUTES = 30;

export type AppointmentSlotTiming = {
  endAt?: Date | null;
  startAt?: Date | null;
  scheduledAt?: Date | null;
  date?: Date | null;
  time?: string | null;
  durationMinutes?: number | null;
};

/** End of the booked slot: prefer endAt, else start + duration (default 30 minutes). */
export function resolveAppointmentEndAt(
  appointment: AppointmentSlotTiming
): Date | null {
  if (appointment.endAt instanceof Date && !Number.isNaN(appointment.endAt.getTime())) {
    return appointment.endAt;
  }

  const start =
    (appointment.scheduledAt instanceof Date && !Number.isNaN(appointment.scheduledAt.getTime())
      ? appointment.scheduledAt
      : null) ??
    (appointment.startAt instanceof Date && !Number.isNaN(appointment.startAt.getTime())
      ? appointment.startAt
      : null) ??
    resolveScheduledAt({
      date: appointment.date ?? undefined,
      time: appointment.time ?? undefined,
      startAt: appointment.startAt ?? undefined,
      scheduledAt: appointment.scheduledAt ?? undefined,
    });

  if (!start) return null;

  const minutes =
    typeof appointment.durationMinutes === 'number' &&
    Number.isFinite(appointment.durationMinutes) &&
    appointment.durationMinutes > 0
      ? appointment.durationMinutes
      : DEFAULT_SLOT_DURATION_MINUTES;

  return new Date(start.getTime() + minutes * 60_000);
}

export function hasConsultBeenStarted(appointment: {
  status?: string | null;
  teleconsult?: {
    status?: string | null;
    doctorJoinedAt?: Date | null;
    patientJoinedAt?: Date | null;
  } | null;
}): boolean {
  if (appointment.status === 'completed') return true;
  const teleconsult = appointment.teleconsult;
  if (!teleconsult) return false;
  if (teleconsult.doctorJoinedAt || teleconsult.patientJoinedAt) return true;
  const status = String(teleconsult.status ?? '').toLowerCase();
  return status === 'waiting' || status === 'in_progress' || status === 'ended';
}

/** True when a confirmed visit's slot has ended and no consult was started. */
export function shouldAutoMarkNoShow(
  appointment: AppointmentSlotTiming & {
    status?: string | null;
    teleconsult?: {
      status?: string | null;
      doctorJoinedAt?: Date | null;
      patientJoinedAt?: Date | null;
    } | null;
  },
  now: Date = new Date()
): boolean {
  if (!canAutoNoShowStatus(appointment.status)) return false;
  if (hasConsultBeenStarted(appointment)) return false;
  const endAt = resolveAppointmentEndAt(appointment);
  if (!endAt) return false;
  return now.getTime() > endAt.getTime();
}

export function formatAppointmentStatusLabel(
  status: CanonicalAppointmentStatus | string | null | undefined
): string {
  switch (status) {
    case 'no_show':
      return 'Missed';
    case 'rescheduled':
      return 'Change requested';
    case 'auto_cancelled':
      return 'Cancelled';
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Pending';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return String(status ?? 'Unknown').replace(/_/g, ' ');
  }
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const fn = (value as { toDate?: unknown }).toDate;
    if (typeof fn === 'function') {
      const parsed = fn.call(value);
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    const seconds = (value as { seconds: number; nanoseconds?: number }).seconds;
    const nanos = (value as { nanoseconds?: number }).nanoseconds ?? 0;
    return new Date(seconds * 1000 + nanos / 1_000_000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const combineDateAndTimeString = (dateValue: unknown, timeValue: string): Date | null => {
  const day = toDate(dateValue);
  if (!day) return null;

  const match = timeValue.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const period = match[4]?.toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const result = new Date(day);
  result.setHours(hours, minutes, seconds, 0);
  return Number.isNaN(result.getTime()) ? null : result;
};

/**
 * Resolve the actual visit instant. Prefer scheduledAt (UTC Timestamp).
 * Fall back to startAt, then date+time, then a Timestamp stored in `time`.
 */
export function resolveScheduledAt(data: Record<string, unknown>): Date | null {
  const fromCanonical = toDate(data.scheduledAt);
  if (fromCanonical) return fromCanonical;

  const fromStartAt = toDate(data.startAt);
  if (fromStartAt) return fromStartAt;

  const timeRaw = data.time;
  if (timeRaw && typeof timeRaw === 'object') {
    const fromTimeStamp = toDate(timeRaw);
    if (fromTimeStamp) return fromTimeStamp;
  }

  if (typeof timeRaw === 'string' && timeRaw.trim()) {
    const combined = combineDateAndTimeString(data.date, timeRaw);
    if (combined) return combined;
  }

  return toDate(data.date);
}

export function formatAppointmentClock(
  instant: Date | null,
  timeZone?: string
): string {
  if (!instant) return 'Time unavailable';
  return instant.toLocaleTimeString('en-ZA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  });
}

export function appointmentCopyPaths(input: {
  appointmentId: string;
  patientId?: string | null;
  doctorId: string;
}): string[] {
  const paths = [
    `appointments/${input.appointmentId}`,
    `Users/${input.doctorId}/appointments/${input.appointmentId}`,
  ];
  if (input.patientId && !String(input.patientId).startsWith('manual_')) {
    paths.push(`Users/${input.patientId}/appointments/${input.appointmentId}`);
  }
  return paths;
}
