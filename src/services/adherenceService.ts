import { djangoListAdherence, djangoListMood, djangoSaveMoodEntry, type DjangoAdherenceRecord } from './djangoApiService';
import { getVitalsRecordsForDate } from './logsService';
import { convertTimestamp, getDateString } from '../utils/dateFormatter';
import { mapInBatches } from '../utils/asyncBatch';

interface AdherenceRecord {
  date: string;
  medicationName: string;
  dosage?: string;
  scheduledTime: Date;
  status: 'taken' | 'missed' | 'pending';
  takenTime?: Date;
  notes?: string;
  timeSlot?: 'morning' | 'afternoon' | 'evening';
}

interface DailyAdherenceSummary {
  date: string;
  totalSlots: number;
  takenSlots: number;
  missedSlots: number;
  adherencePercentage: number;
}

export interface DayAdherenceDetails {
  date: string;
  taken: number;
  missed: number;
  pending: number;
  total: number;
  percentage: number;
}

export interface MonthlyAdherenceSummary {
  takenTotal: number;
  missedTotal: number;
  pendingTotal: number;
  adherencePercentage: number;
}

export interface MonthlyAdherenceDetailsResult {
  dayMap: Map<string, DayAdherenceDetails>;
  monthStats: MonthlyAdherenceSummary;
}

export interface DoctorAdherenceLog {
  id: string;
  medicationName: string;
  dosage: string;
  status: 'taken' | 'missed' | 'pending';
  scheduledTime: Date | null;
  takenTime: Date | null;
  timestamp: Date | null;
  notes?: string;
}

export interface DoctorAdherenceLogsPage {
  logs: DoctorAdherenceLog[];
  hasMore: boolean;
  cursor: Date | null;
}

export interface PatientAdherenceListSummary {
  patientId: string;
  adherenceRate: number;
  takenCount: number;
  missedCount: number;
  pendingCount: number;
  statusLabel: 'excellent' | 'moderate' | 'low' | 'no-data';
}

type AdherenceRecordType = 'medication' | 'vital' | 'mood';

type AdherenceQueryOptions = {
  /** Match patient app: medication adherence excludes vitals/mood. */
  type?: AdherenceRecordType;
  /**
   * When true (default), month/range % ignores future pending doses
   * so doctor stats match patient "through today" math.
   */
  excludeFuturePendingFromStats?: boolean;
};

type AdherenceDoc = { id: string; data: Record<string, unknown> };

const getStartAndEndOfMonth = (year: number, month: number) => {
  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

const toDateKey = (value: Date): string => getDateString(value);

const normalizeStatus = (status: unknown): 'taken' | 'missed' | 'pending' => {
  if (status === 'taken' || status === 'missed' || status === 'pending') {
    return status;
  }
  return 'pending';
};

const endOfToday = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
};

const formatDosage = (dosage: unknown, dosageUnit?: unknown): string => {
  if (dosage == null || dosage === '') return 'Not specified';
  const unit = typeof dosageUnit === 'string' && dosageUnit.trim() ? ` ${dosageUnit}` : '';
  return `${dosage}${unit}`;
};

const djangoRecordToDoc = (record: DjangoAdherenceRecord): AdherenceDoc => ({
  id: record.id,
  data: record as Record<string, unknown>,
});

const fetchAdherenceDocs = async (
  patientId: string,
  params: {
    fromDate?: Date;
    toDate?: Date;
    type?: AdherenceRecordType;
    limit?: number;
  },
): Promise<AdherenceDoc[]> => {
  const rows = await djangoListAdherence(patientId, {
    fromDate: params.fromDate?.toISOString(),
    toDate: params.toDate?.toISOString(),
    type: params.type,
    limit: params.limit ?? 500,
  });
  return rows.map(djangoRecordToDoc);
};

const parseDoctorLog = (id: string, data: Record<string, unknown>): DoctorAdherenceLog => {
  const scheduledTime = convertTimestamp(data.scheduledTime ?? data.scheduledFor);
  const takenTime = convertTimestamp(data.takenTime ?? data.recordedAt);
  const timestamp = convertTimestamp(data.timestamp ?? data.createdAt) ?? scheduledTime;

  return {
    id,
    medicationName: (data.medicationName as string) || 'Unknown',
    dosage: formatDosage(data.dosage, data.dosageUnit),
    status: normalizeStatus(data.status),
    scheduledTime,
    takenTime,
    timestamp,
    notes: data.notes as string | undefined,
  };
};

const buildAdherenceDetailsFromDocs = (
  docs: AdherenceDoc[],
  options: AdherenceQueryOptions = {},
): MonthlyAdherenceDetailsResult => {
  const {
    type = 'medication',
    excludeFuturePendingFromStats = true,
  } = options;
  const statsCutoff = endOfToday();
  const dayMap = new Map<string, DayAdherenceDetails>();

  let takenTotal = 0;
  let missedTotal = 0;
  let pendingTotal = 0;
  let rateTaken = 0;
  let rateDenom = 0;

  docs.forEach((entryDoc) => {
    const data = entryDoc.data;
    const recordType = (data.type as AdherenceRecordType | undefined)
      ?? (data.itemType as AdherenceRecordType | undefined)
      ?? 'medication';
    if (type && recordType !== type) return;

    const scheduledTime = convertTimestamp(data.scheduledTime ?? data.scheduledFor);
    if (!scheduledTime) return;

    const status = normalizeStatus(data.status);
    const dateKey = toDateKey(scheduledTime);

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        date: dateKey,
        taken: 0,
        missed: 0,
        pending: 0,
        total: 0,
        percentage: 0,
      });
    }

    const day = dayMap.get(dateKey)!;
    day.total += 1;
    if (status === 'taken') day.taken += 1;
    if (status === 'missed') day.missed += 1;
    if (status === 'pending') day.pending += 1;
    day.percentage = day.total > 0 ? Math.round((day.taken / day.total) * 100) : 0;

    const includeInStats =
      !excludeFuturePendingFromStats ||
      status !== 'pending' ||
      scheduledTime.getTime() <= statsCutoff.getTime();

    if (!includeInStats) return;

    if (status === 'taken') {
      takenTotal += 1;
      rateTaken += 1;
      rateDenom += 1;
    } else if (status === 'missed') {
      missedTotal += 1;
      rateDenom += 1;
    } else {
      pendingTotal += 1;
      rateDenom += 1;
    }
  });

  return {
    dayMap,
    monthStats: {
      takenTotal,
      missedTotal,
      pendingTotal,
      adherencePercentage: rateDenom > 0 ? Math.round((rateTaken / rateDenom) * 100) : 0,
    },
  };
};

export const getAdherenceDetailsInRange = async (
  patientId: string,
  startDate: Date,
  endDate: Date,
  options: AdherenceQueryOptions = {},
): Promise<MonthlyAdherenceDetailsResult> => {
  const docs = await fetchAdherenceDocs(patientId, {
    fromDate: startDate,
    toDate: endDate,
    type: options.type ?? 'medication',
    limit: 500,
  });
  return buildAdherenceDetailsFromDocs(docs, options);
};

const getMonthlyAdherenceDetailsCore = async (
  patientId: string,
  year: number,
  month: number,
  options: AdherenceQueryOptions = {},
): Promise<MonthlyAdherenceDetailsResult> => {
  const { startDate, endDate } = getStartAndEndOfMonth(year, month);
  return getAdherenceDetailsInRange(patientId, startDate, endDate, {
    type: 'medication',
    excludeFuturePendingFromStats: true,
    ...options,
  });
};

export const getMonthlyAdherence = async (
  patientId: string,
  year: number,
  month: number,
): Promise<Map<string, 'taken' | 'missed' | 'pending'>> => {
  const details = await getMonthlyAdherenceDetailsCore(patientId, year, month);
  const adherenceMap = new Map<string, 'taken' | 'missed' | 'pending'>();

  details.dayMap.forEach((day) => {
    const dateStr = day.date;
    let status: 'taken' | 'missed' | 'pending' = 'pending';
    if (day.taken > 0) status = 'taken';
    else if (day.missed > 0 && day.pending === 0) status = 'missed';
    const existing = adherenceMap.get(dateStr);
    if (!existing || status === 'taken') {
      adherenceMap.set(dateStr, status);
    }
  });

  return adherenceMap;
};

export const getMonthlyAdherenceDetails = async (
  patientId: string,
  year: number,
  month: number,
): Promise<MonthlyAdherenceDetailsResult> => {
  return getMonthlyAdherenceDetailsCore(patientId, year, month);
};

export const getDoctorMonthlyAdherenceDetails = async (
  _doctorId: string,
  patientId: string,
  year: number,
  month: number,
): Promise<MonthlyAdherenceDetailsResult> => {
  return getMonthlyAdherenceDetailsCore(patientId, year, month);
};

export const getDoctorAdherenceDetailsInRange = async (
  _doctorId: string,
  patientId: string,
  startDate: Date,
  endDate: Date,
  options: AdherenceQueryOptions = {},
): Promise<MonthlyAdherenceDetailsResult> => {
  return getAdherenceDetailsInRange(patientId, startDate, endDate, {
    type: 'medication',
    excludeFuturePendingFromStats: true,
    ...options,
  });
};

export const getDoctorMonthlyAdherence = async (
  _doctorId: string,
  patientId: string,
  year: number,
  month: number,
): Promise<Map<string, 'taken' | 'missed' | 'pending'>> => {
  return getMonthlyAdherence(patientId, year, month);
};

const inferTimeSlot = (
  scheduledTime: Date,
  checkType?: string,
): 'morning' | 'afternoon' | 'evening' => {
  if (checkType === 'afternoon' || checkType === 'evening') return 'afternoon';
  if (checkType === 'morning') return 'morning';
  const hour = scheduledTime.getHours();
  if (hour >= 9 && hour < 17) return 'afternoon';
  if (hour >= 17 || hour < 1) return 'evening';
  return 'morning';
};

export const getDailyAdherence = async (
  patientId: string,
  date: string,
): Promise<{
  date: string;
  medications: AdherenceRecord[];
  mood?: Record<string, unknown>;
  vitals?: unknown;
  summary: DailyAdherenceSummary;
}> => {
  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59`);

  const [adherenceDocs, moodEntries] = await Promise.all([
    fetchAdherenceDocs(patientId, {
      fromDate: startOfDay,
      toDate: endOfDay,
      limit: 200,
    }),
    djangoListMood(patientId, {
      fromDate: startOfDay.toISOString(),
      toDate: endOfDay.toISOString(),
      limit: 50,
    }),
  ]);

  const medications: AdherenceRecord[] = [];

  const NUMERIC_MOOD: Record<number, { emoji: string; label: string }> = {
    5: { emoji: '😄', label: 'Very Happy' },
    4: { emoji: '🙂', label: 'Happy' },
    3: { emoji: '😐', label: 'Neutral' },
    2: { emoji: '😔', label: 'Sad' },
    1: { emoji: '😢', label: 'Very Sad' },
  };

  const STRING_MOOD_EMOJIS: Record<string, string> = {
    happy: '😊',
    neutral: '😐',
    sad: '😔',
    anxious: '😰',
    tired: '😴',
    frustrated: '😤',
    calm: '😌',
    thoughtful: '🤔',
    excellent: '😄',
    good: '🙂',
    okay: '😐',
    bad: '😟',
    terrible: '😢',
  };

  adherenceDocs.forEach((entryDoc) => {
    const data = entryDoc.data;
    const recordType = (data.type as string | undefined)
      ?? (data.itemType as string | undefined)
      ?? 'medication';
    if (recordType !== 'medication') return;

    const scheduledTime = convertTimestamp(data.scheduledTime ?? data.scheduledFor)
      ?? new Date(`${date}T00:00:00`);
    const takenTime = convertTimestamp(data.takenTime ?? data.recordedAt);

    medications.push({
      date,
      medicationName: (data.medicationName as string) || 'Unknown',
      dosage: formatDosage(data.dosage, data.dosageUnit),
      scheduledTime,
      status: normalizeStatus(data.status),
      takenTime: takenTime ?? undefined,
      notes: data.notes as string | undefined,
      timeSlot: inferTimeSlot(scheduledTime),
    });
  });

  const moodByTimeSlot: Record<string, unknown> = {};

  moodEntries.forEach((moodEntry) => {
    const createdAt = convertTimestamp(moodEntry.createdAt ?? moodEntry.recordedAt)
      ?? new Date(`${date}T00:00:00`);
    const timeSlot = inferTimeSlot(createdAt, moodEntry.checkType);

    if (!moodByTimeSlot[timeSlot]) {
      const moodValue: unknown = moodEntry.mood ?? moodEntry.score;
      const numericLevel = typeof moodValue === 'number' ? moodValue : Number(moodValue);
      const numeric = NUMERIC_MOOD[numericLevel];
      const moodLabel = typeof moodValue === 'string' ? moodValue : String(moodValue ?? '');
      const emoji =
        numeric?.emoji ||
        STRING_MOOD_EMOJIS[moodLabel.toLowerCase()] ||
        '❓';
      const level = numeric?.label || moodLabel || 'Unknown';

      moodByTimeSlot[timeSlot] = {
        emoji,
        level,
        notes: moodEntry.note ?? moodEntry.notes,
        timeSlot,
        createdAt: createdAt.toISOString(),
      };
    }
  });

  const vitalRecords = adherenceDocs
    .map((entryDoc) => {
      const data = entryDoc.data;
      if (((data.type as string | undefined) ?? (data.itemType as string | undefined) ?? '') !== 'vital') {
        return null;
      }
      const scheduledTime = convertTimestamp(data.scheduledTime ?? data.scheduledFor);
      return {
        id: entryDoc.id,
        name: (data.medicationName as string) || 'Vital',
        value: data.recordedValue ?? null,
        unit: data.unit ?? null,
        status: normalizeStatus(data.status),
        scheduledTime,
        takenTime: convertTimestamp(data.takenTime ?? data.recordedAt),
        notes: data.notes,
      };
    })
    .filter(Boolean);

  const legacyVitals = await getVitalsRecordsForDate(patientId, date);
  const vitals =
    vitalRecords.length > 0
      ? { readings: vitalRecords, legacy: legacyVitals }
      : legacyVitals;

  const takenCount = medications.filter((m) => m.status === 'taken').length;
  const missedCount = medications.filter((m) => m.status === 'missed').length;
  const totalCount = medications.length;

  const summary: DailyAdherenceSummary = {
    date,
    totalSlots: totalCount,
    takenSlots: takenCount,
    missedSlots: missedCount,
    adherencePercentage: totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0,
  };

  return {
    date,
    medications,
    mood: moodByTimeSlot,
    vitals,
    summary,
  };
};

export const getDoctorDailyAdherence = async (
  _doctorId: string,
  patientId: string,
  date: string,
): Promise<{
  date: string;
  medications: AdherenceRecord[];
  mood?: Record<string, unknown>;
  vitals?: unknown;
  summary: DailyAdherenceSummary;
}> => {
  return getDailyAdherence(patientId, date);
};

export const getDoctorAdherenceLogsPage = async (
  _doctorId: string,
  patientId: string,
  pageSize = 10,
  cursor: Date | null = null,
): Promise<DoctorAdherenceLogsPage> => {
  const params: {
    type: 'medication';
    limit: number;
    toDate?: string;
  } = {
    type: 'medication',
    limit: pageSize,
  };

  if (cursor) {
    params.toDate = new Date(cursor.getTime() - 1).toISOString();
  }

  const rows = await djangoListAdherence(patientId, params);
  const logs = rows.map((row) => parseDoctorLog(row.id, row as Record<string, unknown>));

  const lastLog = logs[logs.length - 1];
  return {
    logs,
    hasMore: logs.length === pageSize,
    cursor: lastLog?.scheduledTime ?? lastLog?.timestamp ?? null,
  };
};

export const getDoctorPatientAdherenceSummary = async (
  _doctorId: string,
  patientId: string,
  daysBack = 30,
): Promise<PatientAdherenceListSummary> => {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  const now = endOfToday();
  const docs = await fetchAdherenceDocs(patientId, {
    fromDate: since,
    toDate: now,
    type: 'medication',
    limit: 500,
  });

  let takenCount = 0;
  let missedCount = 0;
  let pendingCount = 0;

  docs.forEach((entryDoc) => {
    const data = entryDoc.data;
    const recordType = (data.type as string | undefined)
      ?? (data.itemType as string | undefined)
      ?? 'medication';
    if (recordType !== 'medication') return;
    const status = normalizeStatus(data.status);
    if (status === 'taken') takenCount += 1;
    if (status === 'missed') missedCount += 1;
    if (status === 'pending') pendingCount += 1;
  });

  const total = takenCount + missedCount + pendingCount;
  const adherenceRate = total > 0 ? Math.round((takenCount / total) * 100) : 0;

  let statusLabel: PatientAdherenceListSummary['statusLabel'] = 'no-data';
  if (total > 0 && adherenceRate >= 85) statusLabel = 'excellent';
  else if (total > 0 && adherenceRate >= 60) statusLabel = 'moderate';
  else if (total > 0) statusLabel = 'low';

  return {
    patientId,
    adherenceRate,
    takenCount,
    missedCount,
    pendingCount,
    statusLabel,
  };
};

const ADHERENCE_SUMMARY_BATCH = 6;
const ADHERENCE_SUMMARY_CAP = 80;

export const getDoctorPatientsAdherenceSummary = async (
  doctorId: string,
  patientIds: string[],
  daysBack = 30,
): Promise<Map<string, PatientAdherenceListSummary>> => {
  const summaryMap = new Map<string, PatientAdherenceListSummary>();
  const ids = patientIds.filter(Boolean).slice(0, ADHERENCE_SUMMARY_CAP);

  const results = await mapInBatches(ids, ADHERENCE_SUMMARY_BATCH, async (patientId) => {
    try {
      return await getDoctorPatientAdherenceSummary(doctorId, patientId, daysBack);
    } catch {
      return {
        patientId,
        adherenceRate: 0,
        takenCount: 0,
        missedCount: 0,
        pendingCount: 0,
        statusLabel: 'no-data' as const,
      };
    }
  });

  results.forEach((summary) => {
    summaryMap.set(summary.patientId, summary);
  });

  return summaryMap;
};

export const getAdherenceStats = async (
  patientId: string,
  fromDate: string,
  toDate: string,
): Promise<{
  totalDays: number;
  adherenceDays: number;
  missedDays: number;
  pendingDays: number;
  averageAdherence: number;
}> => {
  const startDate = new Date(`${fromDate}T00:00:00`);
  const endDate = new Date(`${toDate}T23:59:59`);
  const details = await getAdherenceDetailsInRange(patientId, startDate, endDate, {
    type: 'medication',
    excludeFuturePendingFromStats: true,
  });

  let adherenceDays = 0;
  let missedDays = 0;
  let pendingDays = 0;
  let totalAdherence = 0;

  details.dayMap.forEach((day) => {
    if (day.total <= 0) return;
    totalAdherence += day.percentage;
    if (day.percentage === 100 && day.pending === 0) {
      adherenceDays += 1;
    } else if (day.taken === 0 && day.missed > 0) {
      missedDays += 1;
    } else {
      pendingDays += 1;
    }
  });

  const totalDays = details.dayMap.size;
  const averageAdherence =
    totalDays > 0 ? Math.round(totalAdherence / totalDays) : details.monthStats.adherencePercentage;

  return {
    totalDays,
    adherenceDays,
    missedDays,
    pendingDays,
    averageAdherence,
  };
};

const MOOD_KEY_TO_SCORE: Record<string, number> = {
  happy: 4,
  neutral: 3,
  sad: 2,
  anxious: 2,
  tired: 2,
  frustrated: 2,
  calm: 4,
  thoughtful: 3,
  excellent: 5,
  good: 4,
  okay: 3,
  bad: 2,
  terrible: 1,
};

export const saveMoodEntry = async (
  patientId: string,
  date: string,
  mood: string,
  notes?: string,
): Promise<void> => {
  const score = MOOD_KEY_TO_SCORE[mood.toLowerCase()] ?? 3;
  await djangoSaveMoodEntry(patientId, {
    mood: score,
    score,
    note: notes || '',
    notes: notes || '',
    date,
    recordedAt: new Date(`${date}T12:00:00`).toISOString(),
  });
};
