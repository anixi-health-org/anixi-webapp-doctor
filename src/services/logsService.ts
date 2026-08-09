import { collection, getDocs, query, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MoodLog, AdherenceLog, VitalsLog, DailyLog } from '../types';
const convertAllTimestamps = (obj: any, path: string = ''): any => {
  if (obj === null || obj === undefined) return obj;
  if (obj.toDate && typeof obj.toDate === 'function') {
    const converted = obj.toDate();
    return converted;
  }
  if (
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    obj.seconds !== undefined &&
    obj.nanoseconds !== undefined
  ) {
    const converted = new Date(obj.seconds * 1000);
    return converted;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, idx) => convertAllTimestamps(item, `${path}[${idx}]`));
  }
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const newPath = path ? `${path}.${key}` : key;
        if (value && typeof value === 'object') {
          converted[key] = convertAllTimestamps(value, newPath);
        } else {
          converted[key] = value;
        }
      }
    }
    return converted;
  }
  return obj;
};
export const getPatientMedications = async (patientId: string): Promise<any[]> => {
  try {
    const medicationsRef = collection(db, `Users/${patientId}/medications`);
    const snapshot = await getDocs(medicationsRef);
    const medications: any[] = [];
    snapshot.forEach((doc) => {
      medications.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    const converted = convertAllTimestamps(medications, 'medications');
    return converted;
  } catch (error) {
    ;
    return [];
  }
};
/** Patient app stores one doc per dose (auto-id), not `adherence_records/{yyyy-MM-dd}`. */
export const getAdherenceRecordsForDate = async (patientId: string, dateStr: string): Promise<any[]> => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    const adherenceRef = collection(db, `Users/${patientId}/adherence_records`);
    const q = query(
      adherenceRef,
      where('scheduledTime', '>=', startOfDay),
      where('scheduledTime', '<=', endOfDay)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) =>
      convertAllTimestamps({ id: entry.id, ...entry.data() }, `adherence_records/${entry.id}`)
    );
  } catch (error) {
    return [];
  }
};
export const getMoodRecordsForDate = async (patientId: string, dateStr: string): Promise<any> => {
  try {
    const moodRef = doc(db, `Users/${patientId}/mood_records`, dateStr);
    const snapshot = await getDoc(moodRef);
    if (snapshot.exists()) {
      const moodData = snapshot.data();
      const converted = convertAllTimestamps(moodData, 'moodRecord');
      return converted;
    } else {
      return null;
    }
  } catch (error) {
    ;
    return null;
  }
};

export const getMoodEntriesForDate = async (patientId: string, dateStr: string): Promise<any[]> => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    const moodEntriesRef = collection(db, `Users/${patientId}/mood_entries`);
    const q = query(
      moodEntriesRef,
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const entries: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const converted = convertAllTimestamps(data, `mood_entries/${doc.id}`);
      entries.push({
        id: doc.id,
        ...converted,
      });
    });

    return entries;
  } catch (error) {
    ;
    return [];
  }
};

export const getMoodEntriesForMonth = async (patientId: string, year: number, month: number): Promise<any[]> => {
  try {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const moodEntriesRef = collection(db, `Users/${patientId}/mood_entries`);
    const q = query(
      moodEntriesRef,
      where('createdAt', '>=', startOfMonth),
      where('createdAt', '<=', endOfMonth),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const entries: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const converted = convertAllTimestamps(data, `mood_entries/${doc.id}`);
      entries.push({
        id: doc.id,
        ...converted,
      });
    });

    return entries;
  } catch (error) {
    ;
    return [];
  }
};

/** Vital readings are logged on `adherence_records` with type `vital`. */
export const getVitalsRecordsForDate = async (patientId: string, dateStr: string): Promise<any[]> => {
  try {
    const records = await getAdherenceRecordsForDate(patientId, dateStr);
    return records.filter((record) => (record.type ?? '') === 'vital');
  } catch (error) {
    return [];
  }
};

export const getCompleteDayData = async (patientId: string, dateStr: string) => {
  try {
    const [medications, adherenceRecords, moodEntries, vitalsRecords] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
      getMoodEntriesForDate(patientId, dateStr),
      getVitalsRecordsForDate(patientId, dateStr),
    ]);

    const medicationRecords = adherenceRecords.filter(
      (record) => (record.type ?? 'medication') === 'medication'
    );

    const statusByItemOrName = new Map<string, any>();
    medicationRecords.forEach((record) => {
      const key = record.itemId || record.medicationName;
      if (key) statusByItemOrName.set(key, record);
    });

    const medicationsWithAdherence = medications.map((med: any) => {
      const match = statusByItemOrName.get(med.id) || statusByItemOrName.get(med.name);
      return {
        ...med,
        taken: match?.status === 'taken',
        status: match?.status || 'pending',
      };
    });

    return {
      date: dateStr,
      mood: moodEntries[0] || null,
      moodEntries: moodEntries || [],
      medications:
        medicationsWithAdherence.length > 0 ? medicationsWithAdherence : medicationRecords,
      adherenceRecord: { records: medicationRecords },
      vitals: vitalsRecords,
      hasData:
        medicationRecords.length > 0 ||
        vitalsRecords.length > 0 ||
        (moodEntries && moodEntries.length > 0),
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
export const getDayAdherenceData = async (patientId: string, dateStr: string) => {
  try {
    const [medications, adherenceRecords] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
    ]);
    const medicationRecords = adherenceRecords.filter(
      (record) => (record.type ?? 'medication') === 'medication'
    );
    const statusByKey = new Map<string, any>();
    medicationRecords.forEach((record) => {
      const key = record.itemId || record.medicationName;
      if (key) statusByKey.set(key, record);
    });

    const medicationsWithAdherence = (medications || []).map((med) => {
      const match = statusByKey.get(med.id) || statusByKey.get(med.name);
      return {
        ...med,
        taken: match?.status === 'taken',
        status: match?.status || 'pending',
      };
    });

    return {
      date: dateStr,
      medications:
        medicationsWithAdherence.length > 0 ? medicationsWithAdherence : medicationRecords,
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
export const getMoodLogs = async (patientId: string, year: number, month: number): Promise<MoodLog[]> => {
  try {
    // getMoodEntriesForMonth uses 1-based month; callers pass 0-based JS month.
    const entries = await getMoodEntriesForMonth(patientId, year, month + 1);
    return entries.map((entry) => {
      const createdAt =
        entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
      return {
        id: entry.id,
        patientId,
        mood: entry.mood,
        notes: entry.note ?? entry.notes,
        timestamp: createdAt,
      };
    });
  } catch (error) {
    return [];
  }
};

export const getAdherenceLogs = async (patientId: string, year: number, month: number): Promise<AdherenceLog[]> => {
  try {
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const adherenceRef = collection(db, `Users/${patientId}/adherence_records`);
    const q = query(
      adherenceRef,
      where('scheduledTime', '>=', startDate),
      where('scheduledTime', '<=', endDate),
      orderBy('scheduledTime', 'desc')
    );
    const snapshot = await getDocs(q);
    const logs: AdherenceLog[] = [];
    snapshot.forEach((entry) => {
      const data = entry.data();
      if (((data.type as string | undefined) ?? 'medication') !== 'medication') return;
      const scheduled =
        data.scheduledTime?.toDate?.() ??
        (data.scheduledTime ? new Date(data.scheduledTime) : null);
      const takenTime =
        data.takenTime?.toDate?.() ?? (data.takenTime ? new Date(data.takenTime) : null);
      const timestamp = takenTime || scheduled;
      if (!timestamp) return;
      logs.push({
        id: entry.id,
        patientId,
        medicationName: data.medicationName,
        taken: data.status === 'taken',
        timestamp,
        notes: data.notes,
      });
    });
    return logs;
  } catch (error) {
    return [];
  }
};

const parseVitalValue = (name: string, value: string | null | undefined) => {
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

export const getVitalsLogs = async (patientId: string, year: number, month: number): Promise<VitalsLog[]> => {
  try {
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const adherenceRef = collection(db, `Users/${patientId}/adherence_records`);
    const q = query(
      adherenceRef,
      where('scheduledTime', '>=', startDate),
      where('scheduledTime', '<=', endDate),
      orderBy('scheduledTime', 'desc')
    );
    const snapshot = await getDocs(q);
    const logs: VitalsLog[] = [];
    snapshot.forEach((entry) => {
      const data = entry.data();
      if ((data.type as string | undefined) !== 'vital') return;
      if (data.status !== 'taken') return;
      const scheduled =
        data.scheduledTime?.toDate?.() ??
        (data.scheduledTime ? new Date(data.scheduledTime) : null);
      const takenTime =
        data.takenTime?.toDate?.() ?? (data.takenTime ? new Date(data.takenTime) : null);
      const timestamp = takenTime || scheduled;
      if (!timestamp) return;
      const name = data.medicationName || 'Vital';
      logs.push({
        id: entry.id,
        patientId,
        notes: data.notes || `${name}${data.recordedValue ? `: ${data.recordedValue}` : ''}${data.unit ? ` ${data.unit}` : ''}`,
        timestamp,
        ...parseVitalValue(name, data.recordedValue),
      });
    });
    return logs;
  } catch (error) {
    return [];
  }
};
export const getDailyLogs = async (patientId: string, year: number, month: number): Promise<Map<string, DailyLog>> => {
  try {
    const moodLogs = await getMoodLogs(patientId, year, month);
    const adherenceLogs = await getAdherenceLogs(patientId, year, month);
    const vitalsLogs = await getVitalsLogs(patientId, year, month);
    const dailyLogsMap = new Map<string, DailyLog>();
    moodLogs.forEach((log) => {
      const dateStr = log.timestamp.toISOString().split('T')[0]; 
      if (!dailyLogsMap.has(dateStr)) {
        dailyLogsMap.set(dateStr, { date: dateStr });
      }
      const dailyLog = dailyLogsMap.get(dateStr)!;
      dailyLog.mood = log;
    });
    adherenceLogs.forEach((log) => {
      const dateStr = log.timestamp.toISOString().split('T')[0]; 
      if (!dailyLogsMap.has(dateStr)) {
        dailyLogsMap.set(dateStr, { date: dateStr });
      }
      const dailyLog = dailyLogsMap.get(dateStr)!;
      if (!dailyLog.adherence) {
        dailyLog.adherence = [];
      }
      dailyLog.adherence.push(log);
    });
    vitalsLogs.forEach((log) => {
      const dateStr = log.timestamp.toISOString().split('T')[0]; 
      if (!dailyLogsMap.has(dateStr)) {
        dailyLogsMap.set(dateStr, { date: dateStr });
      }
      const dailyLog = dailyLogsMap.get(dateStr)!;
      if (!dailyLog.vitals || log.timestamp > dailyLog.vitals.timestamp) {
        dailyLog.vitals = log;
      }
    });
    return dailyLogsMap;
  } catch (error) {
    ;
    return new Map();
  }
};
