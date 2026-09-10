import {
  djangoGetPracticeDailySchedule,
  djangoSetPracticeDailySchedule,
} from './djangoApiService';
import type { PracticeDailySchedule } from '../types';

export const getPracticeDailySchedule = async (
  practiceId: string,
  date: string,
): Promise<PracticeDailySchedule | null> => {
  try {
    const d = await djangoGetPracticeDailySchedule(practiceId, date);
    if (!d) return null;
    return {
      practiceId,
      date,
      availability: (d.availability as PracticeDailySchedule['availability']) || 'closed',
      openTime: (d.openTime as string) || undefined,
      closeTime: (d.closeTime as string) || undefined,
      note: (d.note as string) || undefined,
      updatedAt: toDate(d.updatedAt),
    };
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
    await djangoSetPracticeDailySchedule(practiceId, date, {
      availability: 'closed',
      openTime: undefined,
      closeTime: undefined,
      note: undefined,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to delete daily schedule',
    );
  }
};

export const listPracticeDailySchedules = async (
  practiceId: string,
): Promise<PracticeDailySchedule[]> => {
  // TODO: replace with a Django listing endpoint once available.
  return [];
};

const toDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (v && typeof v === 'object' && 'seconds' in v) {
    return new Date((v as { seconds: number }).seconds * 1000);
  }
  return new Date();
};
