import type { Appointment } from '../../types';

/** Local YYYY-MM-DD — never use toISOString() (UTC shift). */
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

export const formatMinutesClock = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};
