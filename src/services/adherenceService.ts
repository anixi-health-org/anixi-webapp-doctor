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
import { convertTimestamp } from '../utils/dateFormatter';

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

const toDateKey = (value: Date): string => value.toISOString().split('T')[0];

const normalizeStatus = (status: unknown): 'taken' | 'missed' | 'pending' => {
  if (status === 'taken' || status === 'missed' || status === 'pending') {
    return status;
  }
  return 'pending';
};

const getAdherenceCollectionRef = (patientId: string) => {
  return collection(db, USERS_COLLECTION, patientId, 'adherence_records');
};

const ensureDoctorPatientAccess = async (
  doctorId: string,
  patientId: string
): Promise<void> => {
  const approvedRef = doc(db, USERS_COLLECTION, doctorId, 'approved_patients', patientId);
  const approvedSnapshot = await getDoc(approvedRef);
  if (!approvedSnapshot.exists()) {
    throw new Error('Access denied: patient is not approved for this doctor.');
  }

  const approvedData = approvedSnapshot.data();
  const status = approvedData?.status as string | undefined;
  if (status && status !== 'active') {
    throw new Error('Access denied: patient approval is not active.');
  }
};

const parseDoctorLog = (id: string, data: Record<string, any>): DoctorAdherenceLog => {
  const scheduledTime = convertTimestamp(data.scheduledTime);
  const takenTime = convertTimestamp(data.takenTime);
  const timestamp = convertTimestamp(data.timestamp) ?? scheduledTime;

  return {
    id,
    medicationName: data.medicationName || 'Unknown',
    dosage: data.dosage || 'Not specified',
    status: normalizeStatus(data.status),
    scheduledTime,
    takenTime,
    timestamp,
    notes: data.notes,
  };
};

const getMonthlyAdherenceDetailsCore = async (
  patientId: string,
  year: number,
  month: number
): Promise<MonthlyAdherenceDetailsResult> => {
  const { startDate, endDate } = getStartAndEndOfMonth(year, month);

  const adherenceQuery = query(
    getAdherenceCollectionRef(patientId),
    where('scheduledTime', '>=', startDate),
    where('scheduledTime', '<=', endDate)
  );

  const snapshot = await getDocs(adherenceQuery);
  const dayMap = new Map<string, DayAdherenceDetails>();

  snapshot.docs.forEach((entryDoc) => {
    const data = entryDoc.data();
    const scheduledTime = convertTimestamp(data.scheduledTime);
    if (!scheduledTime) return;

    const dateKey = toDateKey(scheduledTime);
    const status = normalizeStatus(data.status);

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
  });

  const dayValues = Array.from(dayMap.values());
  const takenTotal = dayValues.reduce((sum, day) => sum + day.taken, 0);
  const missedTotal = dayValues.reduce((sum, day) => sum + day.missed, 0);
  const pendingTotal = dayValues.reduce((sum, day) => sum + day.pending, 0);
  const totalCount = takenTotal + missedTotal + pendingTotal;

  return {
    dayMap,
    monthStats: {
      takenTotal,
      missedTotal,
      pendingTotal,
      adherencePercentage: totalCount > 0 ? Math.round((takenTotal / totalCount) * 100) : 0,
    },
  };
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

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const scheduledTime = convertTimestamp(data.scheduledTime) || new Date(date + 'T00:00:00');
      const takenTime = convertTimestamp(data.takenTime);

      const hour = scheduledTime.getHours();
      let timeSlot: 'morning' | 'afternoon' | 'evening' = 'morning';
      if (hour >= 9 && hour < 17) timeSlot = 'afternoon';
      else if (hour >= 17 || hour < 1) timeSlot = 'evening';

      const record: AdherenceRecord = {
        date: date,
        medicationName: data.medicationName || 'Unknown',
        dosage: data.dosage,
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
      moodSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = convertTimestamp(data.createdAt) || new Date(date + 'T00:00:00');
        const hour = createdAt.getHours();

        let timeSlot: 'morning' | 'afternoon' | 'evening' = 'morning';
        if (hour >= 9 && hour < 17) timeSlot = 'afternoon';
        else if (hour >= 17 || hour < 1) timeSlot = 'evening';

        if (!moodByTimeSlot[timeSlot]) {
          const moodEmojis: Record<string, string> = {
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

          moodByTimeSlot[timeSlot] = {
            emoji: moodEmojis[data.mood] || '❓',
            level: data.mood || 'Unknown',
            notes: data.notes,
            timeSlot,
            createdAt: createdAt.toISOString(),
          };
        }
      });

    } else {
    }

    const vitals = await getVitalsRecordsForDate(patientId, date);

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

  const adherenceQuery = query(
    getAdherenceCollectionRef(patientId),
    where('scheduledTime', '>=', since),
    orderBy('scheduledTime', 'desc')
  );
  const snapshot = await getDocs(adherenceQuery);

  let takenCount = 0;
  let missedCount = 0;
  let pendingCount = 0;

  snapshot.docs.forEach((entryDoc) => {
    const status = normalizeStatus(entryDoc.data().status);
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
    const adherenceRef = collection(
      db,
      USERS_COLLECTION,
      patientId,
      'medication_adherence'
    );

    const q = query(
      adherenceRef,
      where('date', '>=', fromDate),
      where('date', '<=', toDate)
    );

    const snapshot = await getDocs(q);
    const dateMap = new Map<string, Map<string, string>>();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const date = data.date;

      if (!dateMap.has(date)) {
        dateMap.set(date, new Map());
      }

      const dayMap = dateMap.get(date)!;
      const med = data.medicationName || data.medication;
      dayMap.set(med, data.taken === true ? 'taken' : 'missed');
    });

    let adherenceDays = 0;
    let missedDays = 0;
    let pendingDays = 0;
    let totalAdherence = 0;

    dateMap.forEach((dayMap) => {
      const values = Array.from(dayMap.values());
      const takenCount = values.filter((v) => v === 'taken').length;
      const totalCount = values.length;

      if (totalCount > 0) {
        const dayAdherence = (takenCount / totalCount) * 100;
        totalAdherence += dayAdherence;

        if (dayAdherence === 100) {
          adherenceDays++;
        } else if (dayAdherence === 0) {
          missedDays++;
        } else {
          pendingDays++;
        }
      }
    });

    const totalDays = dateMap.size;
    const averageAdherence =
      totalDays > 0 ? Math.round(totalAdherence / totalDays) : 0;

    return {
      totalDays,
      adherenceDays,
      missedDays,
      pendingDays,
      averageAdherence,
    };
  } catch (err) {
    ;
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


