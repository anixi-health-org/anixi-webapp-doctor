import type { Appointment } from '../../types';

/** Local YYYY-MM-DD - never use toISOString() (UTC shift). */
export const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    if (!Number.isNaN(seconds)) return new Date(seconds * 1000);
  }
  return null;
};

/** Minutes from midnight for labels like "17:46" or "5:46 PM". */
export const parseTimeToMinutes = (timeStr: string | undefined | null): number | null => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const cleaned = timeStr.trim();
  const ampm = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (Number.isNaN(h) || Number.isNaN(m) || m > 59) return null;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    if (h > 23) return null;
    return h * 60 + m;
  }
  const h24 = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24) {
    const h = Number(h24[1]);
    const m = Number(h24[2]);
    if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  return null;
};

/**
 * All local calendar days this appointment might belong to.
 * Checks both `date` and `startAt` so timezone drift on one field
 * does not hide the visit from stats / day agenda.
 */
export const appointmentDateKeys = (apt: Appointment): string[] => {
  const keys = new Set<string>();
  const date = asDate(apt.date);
  const startAt = asDate(apt.startAt);
  if (date) keys.add(toDateKey(date));
  if (startAt) keys.add(toDateKey(startAt));
  return Array.from(keys);
};

export const appointmentOnDate = (apt: Appointment, dateKey: string): boolean =>
  appointmentDateKeys(apt).includes(dateKey);

export const appointmentSortMinutes = (apt: Appointment): number => {
  const fromLabel = parseTimeToMinutes(apt.time);
  if (fromLabel != null) return fromLabel;
  const startAt = asDate(apt.startAt);
  if (startAt) return startAt.getHours() * 60 + startAt.getMinutes();
  const date = asDate(apt.date);
  if (date) return date.getHours() * 60 + date.getMinutes();
  return 0;
};

/** Start of a visit in minutes from midnight, or null when it carries no usable time. */
export const appointmentStartMinutes = (apt: Appointment): number | null => {
  const fromLabel = parseTimeToMinutes(apt.time);
  if (fromLabel != null) return fromLabel;
  const at = asDate(apt.startAt) ?? asDate(apt.date);
  return at ? at.getHours() * 60 + at.getMinutes() : null;
};

export const formatHourLabel = (hour: number): string => {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

export const formatMinutesClock = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/** HH:MM (24h) from practice availability blocks. */
export const parseHhmmToMinutes = (hhmm: string | null | undefined): number | null => {
  if (!hhmm) return null;
  const match = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};

/**
 * Hour range a day grid must cover. Visits are included alongside clinic hours
 * so a booking outside the open window is still drawn instead of clipped away.
 */
export const visibleHourRange = (
  windows: { start: number; end: number }[],
  appointments: Appointment[] = [],
  fallback: { startHour: number; endHour: number } = { startHour: 8, endHour: 17 },
): { startHour: number; endHour: number } => {
  const starts: number[] = windows.map((w) => w.start);
  const ends: number[] = windows.map((w) => w.end);

  appointments.forEach((apt) => {
    if (apt.status === 'cancelled') return;
    const start = appointmentStartMinutes(apt);
    if (start == null) return;
    starts.push(start);
    ends.push(start + appointmentDurationMinutes(apt));
  });

  if (starts.length === 0) return fallback;

  const startHour = Math.max(0, Math.floor(Math.min(...starts) / 60));
  const endHour = Math.min(24, Math.ceil(Math.max(...ends) / 60));
  return { startHour, endHour: Math.max(endHour, startHour + 1) };
};

/** Visit length for calendar blocks. Ignore bogus endAt spans (e.g. all-day). */
export const appointmentDurationMinutes = (apt: Appointment): number => {
  if (
    typeof apt.durationMinutes === 'number' &&
    apt.durationMinutes >= 10 &&
    apt.durationMinutes <= 180
  ) {
    return apt.durationMinutes;
  }
  const startAt = asDate(apt.startAt);
  const endAt = asDate(apt.endAt);
  if (startAt && endAt) {
    const duration = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
    if (duration >= 10 && duration <= 180) return duration;
  }
  return 30;
};
