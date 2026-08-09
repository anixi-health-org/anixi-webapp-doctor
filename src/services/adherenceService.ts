import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
} from '../lib/firestoreAdapter';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { getVitalsRecordsForDate } from './logsService';
import { convertTimestamp, getDateString } from '../utils/dateFormatter';

interface AdherenceRecord {
  date: string;
  medicationName: string;
  dosage?: string;
  scheduledTime: any;
  status: 'taken' | 'missed' | 'pending';
  takenTime?: any;
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

const getAdherenceCollectionRef = (patientId: string) => {
  return collection(db, USERS_COLLECTION, patientId, 'adherence_records');
};

type AdherenceRecordType = 'medication' | 'vital' | 'mood';

type AdherenceQueryOptions = {
  /** Match patient app: medication adherence excludes vitals/mood. */
  type?: AdherenceRecordType;
  /**
   * When true (default), month/range % ignores future pending doses
   * so doctor stats match patient “through today” math.
   */
  excludeFuturePendingFromStats?: boolean;
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

/** Align client access checks with Firestore rules (any of three link docs). */
const ensureDoctorPatientAccess = async (
  doctorId: string,
  patientId: string
): Promise<void> => {
  const approvedPatientSnap = await getDoc(
    doc(db, USERS_COLLECTION, doctorId, 'approved_patients', patientId)
  );
  if (approvedPatientSnap.exists()) {
    const status = approvedPatientSnap.data()?.status as string | undefined;
    if (!status || status === 'active') return;
  }

  const approvedShareSnap = await getDoc(
    doc(db, USERS_COLLECTION, patientId, 'approved_shares', doctorId)
  );
  if (approvedShareSnap.exists()) return;

  const approvedDoctorSnap = await getDoc(
    doc(db, USERS_COLLECTION, patientId, 'approved_doctors', doctorId)
  );
  if (approvedDoctorSnap.exists()) {
    const status = approvedDoctorSnap.data()?.status as string | undefined;
    if (!status || status === 'active') return;
  }

  throw new Error('Access denied: patient is not linked to this doctor.');
};

const parseDoctorLog = (id: string, data: Record<string, any>): DoctorAdherenceLog => {
  const scheduledTime = convertTimestamp(data.scheduledTime);
  const takenTime = convertTimestamp(data.takenTime);
  const timestamp = convertTimestamp(data.timestamp) ?? scheduledTime;

  return {
    id,
    medicationName: data.medicationName || 'Unknown',
    dosage: formatDosage(data.dosage, data.dosageUnit),
    status: normalizeStatus(data.status),
    scheduledTime,
    takenTime,
    timestamp,
    notes: data.notes,
  };
};

const buildAdherenceDetailsFromDocs = (
  docs: Array<{ id: string; data: () => Record<string, any> }>,
  options: AdherenceQueryOptions = {}
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
    const data = entryDoc.data();
    const recordType = (data.type as AdherenceRecordType | undefined) ?? 'medication';
    if (type && recordType !== type) return;

    const scheduledTime = convertTimestamp(data.scheduledTime);
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
  options: AdherenceQueryOptions = {}
): Promise<MonthlyAdherenceDetailsResult> => {
  const adherenceQuery = query(
    getAdherenceCollectionRef(patientId),
    where('scheduledTime', '>=', startDate),
    where('scheduledTime', '<=', endDate)
  );
  const snapshot = await getDocs(adherenceQuery);
  return buildAdherenceDetailsFromDocs(snapshot.docs, options);
};

const getMonthlyAdherenceDetailsCore = async (
  patientId: string,
  year: number,
  month: number,
  options: AdherenceQueryOptions = {}
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
  month: number
): Promise<Map<string, 'taken' | 'missed' | 'pending'>> => {
  try {
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
  } catch (err) {
    ;
    throw err;
  }
};

export const getMonthlyAdherenceDetails = async (
  patientId: string,
  year: number,
  month: number
): Promise<MonthlyAdherenceDetailsResult> => {
  return getMonthlyAdherenceDetailsCore(patientId, year, month);
};

export const getDoctorMonthlyAdherenceDetails = async (
  doctorId: string,
  patientId: string,
  year: number,
  month: number
): Promise<MonthlyAdherenceDetailsResult> => {
  await ensureDoctorPatientAccess(doctorId, patientId);
  return getMonthlyAdherenceDetailsCore(patientId, year, month);
};

export const getDoctorAdherenceDetailsInRange = async (
  doctorId: string,
  patientId: string,
  startDate: Date,
  endDate: Date,
  options: AdherenceQueryOptions = {}
): Promise<MonthlyAdherenceDetailsResult> => {
  await ensureDoctorPatientAccess(doctorId, patientId);
  return getAdherenceDetailsInRange(patientId, startDate, endDate, {
    type: 'medication',
    excludeFuturePendingFromStats: true,
    ...options,
  });
};

export const getDoctorMonthlyAdherence = async (
  doctorId: string,
  patientId: string,
  year: number,
  month: number
): Promise<Map<string, 'taken' | 'missed' | 'pending'>> => {
  await ensureDoctorPatientAccess(doctorId, patientId);
  return getMonthlyAdherence(patientId, year, month);
};


export const getDailyAdherence = async (
  patientId: string,
  date: string
): Promise<{
  date: string;
  medications: AdherenceRecord[];
  mood?: any;
  vitals?: any;
  summary: DailyAdherenceSummary;
}> => {
  try {
    const adherenceRef = getAdherenceCollectionRef(patientId);

    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');

    const q = query(
      adherenceRef,
      where('scheduledTime', '>=', startOfDay),
      where('scheduledTime', '<=', endOfDay)
    );

    const snapshot = await getDocs(q);
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

    snapshot.docs.forEach((entryDoc) => {
      const data = entryDoc.data();
      const recordType = (data.type as string | undefined) ?? 'medication';
      if (recordType !== 'medication') return;

      const scheduledTime = convertTimestamp(data.scheduledTime) || new Date(date + 'T00:00:00');
      const takenTime = convertTimestamp(data.takenTime);

      const hour = scheduledTime.getHours();
      let timeSlot: 'morning' | 'afternoon' | 'evening' = 'morning';
      if (hour >= 9 && hour < 17) timeSlot = 'afternoon';
      else if (hour >= 17 || hour < 1) timeSlot = 'evening';

      const record: AdherenceRecord = {
        date: date,
        medicationName: data.medicationName || 'Unknown',
        dosage: formatDosage(data.dosage, data.dosageUnit),
        scheduledTime: scheduledTime,
        status: data.status || 'pending',
        takenTime: takenTime || undefined,
        notes: data.notes,
        timeSlot: timeSlot,
      };

      medications.push(record);
    });

    let moodByTimeSlot: Record<string, any> = {};

    const moodRef = collection(db, USERS_COLLECTION, patientId, 'mood_entries');
    const moodQuery = query(
      moodRef,
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      orderBy('createdAt', 'desc')
    );

    const moodSnapshot = await getDocs(moodQuery);

    if (!moodSnapshot.empty) {
      moodSnapshot.docs.forEach((moodDoc) => {
        const data = moodDoc.data();
        const createdAt = convertTimestamp(data.createdAt) || new Date(date + 'T00:00:00');

        let timeSlot: 'morning' | 'afternoon' | 'evening' =
          data.checkType === 'afternoon' || data.checkType === 'evening'
            ? 'afternoon'
            : data.checkType === 'morning'
              ? 'morning'
              : 'morning';

        if (!data.checkType) {
          const hour = createdAt.getHours();
          if (hour >= 9 && hour < 17) timeSlot = 'afternoon';
          else if (hour >= 17 || hour < 1) timeSlot = 'evening';
        }

        if (!moodByTimeSlot[timeSlot]) {
          const moodValue = data.mood;
          const numericLevel = typeof moodValue === 'number' ? moodValue : Number(moodValue);
          const numeric = NUMERIC_MOOD[numericLevel];
          const emoji =
            numeric?.emoji ||
            (typeof moodValue === 'string' ? STRING_MOOD_EMOJIS[moodValue.toLowerCase()] : null) ||
            '❓';
          const level = numeric?.label || moodValue || 'Unknown';

          moodByTimeSlot[timeSlot] = {
            emoji,
            level,
            notes: data.note ?? data.notes,
            timeSlot,
            createdAt: createdAt.toISOString(),
          };
        }
      });
    }

    // Patient app stores vital readings on adherence_records (type=vital), not vitals_records/{date}.
    const vitalRecords = snapshot.docs
      .map((entryDoc) => {
        const data = entryDoc.data();
        if (((data.type as string | undefined) ?? '') !== 'vital') return null;
        const scheduledTime = convertTimestamp(data.scheduledTime);
        return {
          id: entryDoc.id,
          name: data.medicationName || 'Vital',
          value: data.recordedValue ?? null,
          unit: data.unit ?? null,
          status: normalizeStatus(data.status),
          scheduledTime,
          takenTime: convertTimestamp(data.takenTime),
          notes: data.notes,
        };
      })
      .filter(Boolean);

    const legacyVitals = await getVitalsRecordsForDate(patientId, date);
    const vitals =
      vitalRecords.length > 0
        ? { readings: vitalRecords, legacy: legacyVitals }
        : legacyVitals;

    const takenCount = medications.filter(m => m.status === 'taken').length;
    const missedCount = medications.filter(m => m.status === 'missed').length;
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
  } catch (err) {
    ;
    throw err;
  }
};

export const getDoctorDailyAdherence = async (
  doctorId: string,
  patientId: string,
  date: string
): Promise<{
  date: string;
  medications: AdherenceRecord[];
  mood?: any;
  vitals?: any;
  summary: DailyAdherenceSummary;
}> => {
  await ensureDoctorPatientAccess(doctorId, patientId);
  return getDailyAdherence(patientId, date);
};

export const getDoctorAdherenceLogsPage = async (
  doctorId: string,
  patientId: string,
  pageSize = 10,
  cursor: Date | null = null
): Promise<DoctorAdherenceLogsPage> => {
  await ensureDoctorPatientAccess(doctorId, patientId);

  const constraints: QueryConstraint[] = [orderBy('scheduledTime', 'desc'), limit(pageSize)];
  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor));
  }

  const adherenceQuery = query(getAdherenceCollectionRef(patientId), ...constraints);
  const snapshot = await getDocs(adherenceQuery);

  const logs = snapshot.docs.map((entryDoc) =>
    parseDoctorLog(entryDoc.id, entryDoc.data() as Record<string, any>)
  );

  const lastLog = logs[logs.length - 1];
  return {
    logs,
    hasMore: logs.length === pageSize,
    cursor: lastLog?.scheduledTime ?? lastLog?.timestamp ?? null,
  };
};

export const getDoctorPatientAdherenceSummary = async (
  doctorId: string,
  patientId: string,
  daysBack = 30
): Promise<PatientAdherenceListSummary> => {
  await ensureDoctorPatientAccess(doctorId, patientId);

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  const now = endOfToday();
  const adherenceQuery = query(
    getAdherenceCollectionRef(patientId),
    where('scheduledTime', '>=', since),
    where('scheduledTime', '<=', now),
    orderBy('scheduledTime', 'desc')
  );
  const snapshot = await getDocs(adherenceQuery);

  let takenCount = 0;
  let missedCount = 0;
  let pendingCount = 0;

  snapshot.docs.forEach((entryDoc) => {
    const data = entryDoc.data();
    const recordType = (data.type as string | undefined) ?? 'medication';
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

export const getDoctorPatientsAdherenceSummary = async (
  doctorId: string,
  patientIds: string[],
  daysBack = 30
): Promise<Map<string, PatientAdherenceListSummary>> => {
  const summaryMap = new Map<string, PatientAdherenceListSummary>();

  const results = await Promise.all(
    patientIds.map(async (patientId) => {
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
    })
  );

  results.forEach((summary) => {
    summaryMap.set(summary.patientId, summary);
  });

  return summaryMap;
};


export const getAdherenceStats = async (
  patientId: string,
  fromDate: string,
  toDate: string
): Promise<{
  totalDays: number;
  adherenceDays: number;
  missedDays: number;
  pendingDays: number;
  averageAdherence: number;
}> => {
  try {
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
  } catch (err) {
    throw err;
  }
};


export const saveMoodEntry = async (
  patientId: string,
  date: string,
  mood: string,
  notes?: string
): Promise<void> => {
  try {
    const moodRef = collection(db, USERS_COLLECTION, patientId, 'mood_entries');

    const existingQuery = query(
      moodRef,
      where('date', '==', date)
    );
    const existingSnapshot = await getDocs(existingQuery);

    const moodData = {
      mood: getMoodEmoji(mood),
      notes: notes || '',
      createdAt: new Date(),
      date: date,
    };

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      await updateDoc(existingDoc.ref, moodData);
    } else {
      await addDoc(moodRef, moodData);
    }
  } catch (err) {
    ;
    throw err;
  }
};


const getMoodEmoji = (mood: string): string => {
  const moodEmojis: { [key: string]: string } = {
    happy: '😊 Happy',
    neutral: '😐 Neutral',
    sad: '😔 Sad',
    anxious: '😰 Anxious',
    tired: '😴 Tired',
    frustrated: '😤 Frustrated',
    calm: '😌 Calm',
    thoughtful: '🤔 Thoughtful',
  };

  return moodEmojis[mood] || '😐 Neutral';
};


