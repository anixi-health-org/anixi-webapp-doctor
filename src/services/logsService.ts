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
export const getAdherenceRecordsForDate = async (patientId: string, dateStr: string): Promise<any> => {
  try {
    const adherenceRef = doc(db, `Users/${patientId}/adherence_records`, dateStr);
    const snapshot = await getDoc(adherenceRef);
    if (snapshot.exists()) {
      const adherenceData = snapshot.data();
      const converted = convertAllTimestamps(adherenceData, 'adherenceRecord');
      return converted;
    } else {
      return null;
    }
  } catch (error) {
    ;
    return null;
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

export const getVitalsRecordsForDate = async (patientId: string, dateStr: string): Promise<any> => {
  try {
    const vitalsRef = doc(db, `Users/${patientId}/vitals_records`, dateStr);
    const snapshot = await getDoc(vitalsRef);
    if (snapshot.exists()) {
      const vitalsData = snapshot.data();
      const converted = convertAllTimestamps(vitalsData, 'vitalsRecord');
      return converted;
    } else {
      return null;
    }
  } catch (error) {
    ;
    return null;
  }
};
export const getCompleteDayData = async (patientId: string, dateStr: string) => {
  try {
    const [medications, adherenceRecord, moodRecord, moodEntries, vitalsRecord] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
      getMoodRecordsForDate(patientId, dateStr),
      getMoodEntriesForDate(patientId, dateStr),
      getVitalsRecordsForDate(patientId, dateStr),
    ]);
    const convertedMedications = convertAllTimestamps(medications, 'medications');
    const convertedAdherenceRecord = convertAllTimestamps(adherenceRecord, 'adherenceRecord');
    const convertedMoodRecord = convertAllTimestamps(moodRecord, 'moodRecord');
    const convertedVitalsRecord = convertAllTimestamps(vitalsRecord, 'vitalsRecord');
    
    const medicationsWithAdherence = convertedMedications.map((med: any) => {
      const adheranceStatus = convertedAdherenceRecord?.medications?.[med.id];
      return {
        ...med,
        taken: adheranceStatus?.taken ?? null,
        status: adheranceStatus?.status || 'unknown',
      };
    });

    const finalData = {
      date: dateStr,
      mood: convertedMoodRecord || null,
      moodEntries: moodEntries || [],
      medications: medicationsWithAdherence,
      adherenceRecord: convertedAdherenceRecord || null,
      vitals: convertedVitalsRecord || null,
      hasData: !!convertedAdherenceRecord || !!convertedMoodRecord || (moodEntries && moodEntries.length > 0) || !!convertedVitalsRecord,
    };

    return finalData;
  } catch (error) {
    ;
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
    const [medications, adherenceRecord] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
    ]);
    if (!medications || medications.length === 0) {
      return {
        date: dateStr,
        medications: [],
        adherenceRecord: null,
      };
    }
    const medicationsWithAdherence = medications.map((med) => {
      const adheranceStatus = adherenceRecord?.medications?.[med.id];
      return {
        ...med,
        taken: adheranceStatus?.taken ?? null,
        status: adheranceStatus?.status || 'unknown',
      };
    });
    return {
      date: dateStr,
      medications: medicationsWithAdherence,
      adherenceRecord: adherenceRecord,
      hasData: !!adherenceRecord,
    };
  } catch (error) {
    ;
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
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    try {
      const moodLogsRef = collection(db, `patients/${patientId}/mood_logs`);
      const q = query(moodLogsRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const logs: MoodLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const logDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        if (logDate >= startDate && logDate <= endDate) {
          logs.push({
            id: doc.id,
            patientId,
            mood: data.mood,
            notes: data.notes,
            timestamp: logDate,
          });
        }
      });
      return logs;
    } catch (subcollectionError) {
      return [];
    }
  } catch (error) {
    ;
    return [];
  }
};
export const getAdherenceLogs = async (patientId: string, year: number, month: number): Promise<AdherenceLog[]> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    try {
      const adherenceRef = collection(db, `patients/${patientId}/adherence_logs`);
      const q = query(adherenceRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const logs: AdherenceLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const logDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        if (logDate >= startDate && logDate <= endDate) {
          logs.push({
            id: doc.id,
            patientId,
            medicationName: data.medicationName,
            taken: data.taken,
            timestamp: logDate,
            notes: data.notes,
          });
        }
      });
      return logs;
    } catch (subcollectionError) {
      return [];
    }
  } catch (error) {
    ;
    return [];
  }
};
export const getVitalsLogs = async (patientId: string, year: number, month: number): Promise<VitalsLog[]> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    try {
      const vitalsRef = collection(db, `patients/${patientId}/vitals_logs`);
      const q = query(vitalsRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const logs: VitalsLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const logDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        if (logDate >= startDate && logDate <= endDate) {
          logs.push({
            id: doc.id,
            patientId,
            heartRate: data.heartRate,
            bloodPressure: data.bloodPressure,
            temperature: data.temperature,
            bloodSugar: data.bloodSugar,
            notes: data.notes,
            timestamp: logDate,
          });
        }
      });
      return logs;
    } catch (subcollectionError) {
      return [];
    }
  } catch (error) {
    ;
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
