import {
  djangoDeletePracticeDailySchedule,
  djangoGetPracticeDailySchedule,
  djangoGetPracticeScheduleMap,
  djangoSetPracticeDailySchedule,
} from './djangoApiService';
import type { PracticeDailySchedule } from '../types';

const VALID_AVAILABILITY = new Set(['open', 'limited', 'closed']);

/** Missing or empty API payloads mean "use weekly hours", not a closed day. */
export function parseDailyScheduleRecord(
  practiceId: string,
  date: string,
  row: Record<string, unknown> | null | undefined,
): PracticeDailySchedule | null {
  if (!row || typeof row !== 'object') return null;
  const availabilityRaw = String(row.availability ?? row.status ?? '').trim();
  if (!VALID_AVAILABILITY.has(availabilityRaw)) return null;
  return {
    practiceId,
    date,
    availability: availabilityRaw as PracticeDailySchedule['availability'],
    openTime: typeof row.openTime === 'string' ? row.openTime : undefined,
    closeTime: typeof row.closeTime === 'string' ? row.closeTime : undefined,
    note: typeof row.note === 'string' ? row.note : undefined,
    updatedAt: toDate(row.updatedAt),
  };
}

export const getPracticeDailySchedule = async (
  practiceId: string,
  date: string,
): Promise<PracticeDailySchedule | null> => {
  try {
    const d = await djangoGetPracticeDailySchedule(practiceId, date);
    return parseDailyScheduleRecord(practiceId, date, d);
  } catch (error) {
    return null;
  }
};

export const setPracticeDailySchedule = async (
  schedule: Omit<PracticeDailySchedule, 'updatedAt'>,
): Promise<void> => {
  try {
    await djangoSetPracticeDailySchedule(
      schedule.practiceId,
      schedule.date,
      {
        availability: schedule.availability,
        openTime: schedule.openTime,
        closeTime: schedule.closeTime,
        note: schedule.note,
      },
    );
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to save daily schedule',
    );
  }
};

export const deletePracticeDailySchedule = async (
  practiceId: string,
  date: string,
): Promise<void> => {
  try {
    await djangoDeletePracticeDailySchedule(practiceId, date);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to delete daily schedule',
    );
  }
};

export const listPracticeDailySchedules = async (
  practiceId: string,
): Promise<PracticeDailySchedule[]> => {
  try {
    const payload = await djangoGetPracticeScheduleMap(practiceId);
    const daySchedules = payload.daySchedules || {};
    return Object.entries(daySchedules)
      .filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .map(([date, raw]) =>
        parseDailyScheduleRecord(
          practiceId,
          date,
          raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null,
        ),
      )
      .filter((row): row is PracticeDailySchedule => row != null)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.warn('[practiceCalendar] list daily schedules failed', error);
    return [];
  }
};

const toDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (v && typeof v === 'object' && 'seconds' in v) {
    return new Date((v as { seconds: number }).seconds * 1000);
  }
  return new Date();
};
