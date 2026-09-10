import {
  djangoGetPatientChart,
  djangoGetPatientDayLogs,
  djangoListMood,
} from './djangoApiService';
import { MoodLog, AdherenceLog, VitalsLog, DailyLog } from '../types';

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
};

const toDateOrNow = (value: unknown): Date => toDate(value) ?? new Date();

/**
 * Patient logs have been migrated off Firestore.
 * Once the Django patient-logs endpoint is wired, replace the fallback body below
 * with a call to `djangoGetPatientDayLogs`.
 */
export const getPatientMedications = async (patientId: string): Promise<unknown[]> => {
  try {
    const chart = await djangoGetPatientChart(patientId);
    if (chart && Array.isArray(chart.medications)) {
      return chart.medications;
    }
  } catch (error) {
    /* fall through to empty fallback */
  }
  return [];
};

export const getAdherenceRecordsForDate = async (
  patientId: string,
  dateStr: string,
): Promise<unknown[]> => {
  try {
    const day = await djangoGetPatientDayLogs(patientId, dateStr);
    if (day && Array.isArray(day.adherence_records)) {
      return day.adherence_records;
    }
  } catch (error) {
    /* fall through to empty fallback */
  }
  return [];
};

export const getMoodRecordsForDate = async (
  patientId: string,
  dateStr: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const day = await djangoGetPatientDayLogs(patientId, dateStr);
    if (day && day.mood) return day.mood as Record<string, unknown>;
  } catch (error) {
    /* fall through to null fallback */
  }
  return null;
};

export const getMoodEntriesForDate = async (
  patientId: string,
  dateStr: string,
): Promise<unknown[]> => {
  try {
    const day = await djangoGetPatientDayLogs(patientId, dateStr);
    if (day && Array.isArray(day.mood_entries)) {
      return day.mood_entries;
    }
  } catch (error) {
    /* fall through to empty fallback */
  }
  return [];
};

export const getMoodEntriesForMonth = async (
  patientId: string,
  year: number,
  month: number,
): Promise<Array<Record<string, unknown>>> => {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  try {
    const entries = await djangoListMood(patientId, {
      fromDate: startDate.toISOString(),
      toDate: endDate.toISOString(),
      limit: 200,
    });
    return entries as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
};

export const getVitalsRecordsForDate = async (
  patientId: string,
  dateStr: string,
): Promise<unknown[]> => {
  try {
    const records = await getAdherenceRecordsForDate(patientId, dateStr);
    return (records as Record<string, unknown>[]).filter(
      (record) => (record.type ?? '') === 'vital',
    );
  } catch (error) {
    return [];
  }
};

export const getCompleteDayData = async (
  patientId: string,
  dateStr: string,
) => {
  try {
    const [medications, adherenceRecords, moodEntries, vitalsRecords] =
      await Promise.all([
        getPatientMedications(patientId),
        getAdherenceRecordsForDate(patientId, dateStr),
        getMoodEntriesForDate(patientId, dateStr),
        getVitalsRecordsForDate(patientId, dateStr),
      ]);

    const medicationRecords = (
      adherenceRecords as Record<string, unknown>[]
    ).filter((record) => (record.type ?? 'medication') === 'medication');

    const statusByItemOrName = new Map<string, Record<string, unknown>>();
    medicationRecords.forEach((record) => {
      const key = (record.itemId as string) || (record.medicationName as string);
      if (key) statusByItemOrName.set(key, record);
    });

    const medicationsWithAdherence = (medications as Record<string, unknown>[]).map(
      (med) => {
        const match =
          statusByItemOrName.get(med.id as string) ||
          statusByItemOrName.get(med.name as string);
        return {
          ...med,
          taken: match?.status === 'taken',
          status: (match?.status as string) || 'pending',
        };
      },
    );

    return {
      date: dateStr,
      mood: moodEntries[0] || null,
      moodEntries: moodEntries as unknown[],
      medications:
        medicationsWithAdherence.length > 0
          ? medicationsWithAdherence
          : medicationRecords,
      adherenceRecord: { records: medicationRecords },
      vitals: vitalsRecords as unknown[],
      hasData:
        medicationRecords.length > 0 ||
        vitalsRecords.length > 0 ||
        moodEntries.length > 0,
    };
  } catch (error) {
    return {
      date: dateStr,
      mood: null,
      moodEntries: [],
      medications: [],
      adherenceRecord: null,
      vitals: null,
      hasData: false,
    };
  }
};

export const getDayAdherenceData = async (
  patientId: string,
  dateStr: string,
) => {
  try {
    const [medications, adherenceRecords] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
    ]);
    const medicationRecords = (
      adherenceRecords as Record<string, unknown>[]
    ).filter((record) => (record.type ?? 'medication') === 'medication');
    const statusByKey = new Map<string, Record<string, unknown>>();
    medicationRecords.forEach((record) => {
      const key = (record.itemId as string) || (record.medicationName as string);
      if (key) statusByKey.set(key, record);
    });

    const medicationsWithAdherence = (medications as Record<string, unknown>[]).map(
      (med) => {
        const match =
          statusByKey.get(med.id as string) || statusByKey.get(med.name as string);
        return {
          ...med,
          taken: match?.status === 'taken',
          status: (match?.status as string) || 'pending',
        };
      },
    );

    return {
      date: dateStr,
      medications:
        medicationsWithAdherence.length > 0
          ? medicationsWithAdherence
          : medicationRecords,
      adherenceRecord: { records: medicationRecords },
      hasData: medicationRecords.length > 0,
    };
  } catch (error) {
    return {
      date: dateStr,
      medications: [],
      adherenceRecord: null,
      hasData: false,
    };
  }
};

export const getMoodLogs = async (
  patientId: string,
  year: number,
  month: number,
): Promise<MoodLog[]> => {
  try {
    const entries = await getMoodEntriesForMonth(patientId, year, month + 1);
    return (entries as Record<string, unknown>[]).map((entry) => {
      const createdAt = toDateOrNow(entry.createdAt);
      const rawMood = String(entry.mood ?? 'neutral').toLowerCase();
      const mood: MoodLog['mood'] =
        rawMood === 'terrible' ||
        rawMood === 'bad' ||
        rawMood === 'neutral' ||
        rawMood === 'good' ||
        rawMood === 'excellent'
          ? rawMood
          : 'neutral';
      return {
        id: String(entry.id ?? ''),
        patientId,
        mood,
        notes: (entry.note as string) || (entry.notes as string) || undefined,
        timestamp: createdAt,
      };
    });
  } catch (error) {
    return [];
  }
};

export const getAdherenceLogs = async (
  patientId: string,
  year: number,
  month: number,
): Promise<AdherenceLog[]> => {
  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  try {
    const dayLogs: Record<string, unknown>[] = [];
    // Walk the month day-by-day until the Django day-logs endpoint exists.
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const day = await djangoGetPatientDayLogs(patientId, dateStr);
      if (day && Array.isArray(day.adherence_records)) {
        dayLogs.push(...(day.adherence_records as Record<string, unknown>[]));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const logs: AdherenceLog[] = [];
    dayLogs
      .filter(
        (entry) =>
          ((entry.type as string | undefined) ?? 'medication') === 'medication',
      )
      .forEach((entry) => {
        const scheduled = toDate(entry.scheduledTime) ?? null;
        const takenTime = toDate(entry.takenTime) ?? null;
        const timestamp = takenTime || scheduled;
        if (!timestamp) return;
        logs.push({
          id: String(entry.id ?? ''),
          patientId,
          medicationName: (entry.medicationName as string) || 'Medication',
          taken: (entry.status as string) === 'taken',
          timestamp,
          notes: entry.notes as string | undefined,
        });
      });

    return logs;
  } catch (error) {
    return [];
  }
};

const parseVitalValue = (
  name: string,
  value: string | null | undefined,
): Record<string, unknown> => {
  if (!value) return {};
  const lower = name.toLowerCase();
  if (lower.includes('blood pressure') || lower.includes('bp')) {
    const [systolic, diastolic] = value.split(/[/-]/).map((part) => Number(part.trim()));
    if (!Number.isNaN(systolic) && !Number.isNaN(diastolic)) {
      return { bloodPressure: { systolic, diastolic } };
    }
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return {};
  if (lower.includes('heart') || lower.includes('pulse') || lower.includes('hr')) {
    return { heartRate: numeric };
  }
  if (lower.includes('temp')) return { temperature: numeric };
  if (lower.includes('glucose') || lower.includes('sugar') || lower.includes('blood sugar')) {
    return { bloodSugar: numeric };
  }
  return {};
};

export const getVitalsLogs = async (
  patientId: string,
  year: number,
  month: number,
): Promise<VitalsLog[]> => {
  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  try {
    const dayLogs: Record<string, unknown>[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const day = await djangoGetPatientDayLogs(patientId, dateStr);
      if (day && Array.isArray(day.adherence_records)) {
        dayLogs.push(...(day.adherence_records as Record<string, unknown>[]));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const logs: VitalsLog[] = [];
    dayLogs
      .filter(
        (entry) =>
          (entry.type as string | undefined) === 'vital' &&
          (entry.status as string) === 'taken',
      )
      .forEach((entry) => {
        const scheduled = toDate(entry.scheduledTime) ?? null;
        const takenTime = toDate(entry.takenTime) ?? null;
        const timestamp = takenTime || scheduled;
        if (!timestamp) return;
        const name = (entry.medicationName as string) || 'Vital';
        logs.push({
          id: String(entry.id ?? ''),
          patientId,
          notes:
            (entry.notes as string) ||
            `${name}${entry.recordedValue ? `: ${entry.recordedValue}` : ''}${(entry.unit as string) ? ` ${entry.unit}` : ''}`,
          timestamp,
          ...parseVitalValue(name, entry.recordedValue as string | null | undefined),
        });
      });

    return logs;
  } catch (error) {
    return [];
  }
};

export const getDailyLogs = async (
  patientId: string,
  year: number,
  month: number,
): Promise<Map<string, DailyLog>> => {
  try {
    const moodLogs = await getMoodLogs(patientId, year, month);
    const adherenceLogs = await getAdherenceLogs(patientId, year, month);
    const vitalsLogs = await getVitalsLogs(patientId, year, month);
    const dailyLogsMap = new Map<string, DailyLog>();

    const upsertDate = (timestamp: Date, builder: (log: DailyLog) => void) => {
      const dateStr = timestamp.toISOString().slice(0, 10);
      if (!dailyLogsMap.has(dateStr)) {
        dailyLogsMap.set(dateStr, { date: dateStr } as DailyLog);
      }
      builder(dailyLogsMap.get(dateStr)!);
    };

    moodLogs.forEach((log) =>
      upsertDate(log.timestamp, (dailyLog) => {
        dailyLog.mood = log;
      }),
    );
    adherenceLogs.forEach((log) =>
      upsertDate(log.timestamp, (dailyLog) => {
        if (!dailyLog.adherence) dailyLog.adherence = [];
        dailyLog.adherence.push(log);
      }),
    );
    vitalsLogs.forEach((log) =>
      upsertDate(log.timestamp, (dailyLog) => {
        if (!dailyLog.vitals || log.timestamp > dailyLog.vitals.timestamp) {
          dailyLog.vitals = log;
        }
      }),
    );

    return dailyLogsMap;
  } catch (error) {
    return new Map();
  }
};

