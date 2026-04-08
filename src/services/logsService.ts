import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MoodLog, AdherenceLog, VitalsLog, DailyLog } from '../types';


const convertAllTimestamps = (obj: any, path: string = ''): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (obj.toDate && typeof obj.toDate === 'function') {
    const converted = obj.toDate();
    console.log(`   ✓ Converted toDate() Timestamp at ${path}`);
    return converted;
  }
  
  if (
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    obj.seconds !== undefined &&
    obj.nanoseconds !== undefined
  ) {
    const converted = new Date(obj.seconds * 1000);
    console.log(`   ✓ Converted raw Timestamp {seconds,nanoseconds} at ${path}`);
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
    console.log(`💊 Fetching medications for patient: ${patientId}`);
    const medicationsRef = collection(db, `Users/${patientId}/medications`);
    const snapshot = await getDocs(medicationsRef);

    const medications: any[] = [];
    snapshot.forEach((doc) => {
      medications.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`   ✓ Found ${medications.length} medications - Converting all timestamps...`);
    const converted = convertAllTimestamps(medications, 'medications');
    console.log(`   ✓ Medications conversion complete`);
    return converted;
  } catch (error) {
    console.error('❌ Error fetching medications:', error);
    return [];
  }
};


export const getAdherenceRecordsForDate = async (patientId: string, dateStr: string): Promise<any> => {
  try {
    console.log(`📋 Fetching adherence records for ${patientId} on ${dateStr}`);
    
    const adherenceRef = doc(db, `Users/${patientId}/adherence_records`, dateStr);
    const snapshot = await getDoc(adherenceRef);

    if (snapshot.exists()) {
      console.log(`   ✓ Found adherence data - Converting all timestamps...`);
      const adherenceData = snapshot.data();
      
      const converted = convertAllTimestamps(adherenceData, 'adherenceRecord');
      console.log(`   ✓ Adherence conversion complete`);
      return converted;
    } else {
      console.log(`   ℹ️ No adherence data for ${dateStr}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching adherence records for ${dateStr}:`, error);
    return null;
  }
};


export const getMoodRecordsForDate = async (patientId: string, dateStr: string): Promise<any> => {
  try {
    console.log(`😊 Fetching mood records for ${patientId} on ${dateStr}`);
    
    const moodRef = doc(db, `Users/${patientId}/mood_records`, dateStr);
    const snapshot = await getDoc(moodRef);

    if (snapshot.exists()) {
      console.log(`   ✓ Found mood data - Converting all timestamps...`);
      const moodData = snapshot.data();
      
      const converted = convertAllTimestamps(moodData, 'moodRecord');
      console.log(`   ✓ Mood conversion complete`);
      return converted;
    } else {
      console.log(`   ℹ️ No mood data for ${dateStr}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching mood records for ${dateStr}:`, error);
    return null;
  }
};


export const getVitalsRecordsForDate = async (patientId: string, dateStr: string): Promise<any> => {
  try {
    console.log(`🏥 Fetching vitals records for ${patientId} on ${dateStr}`);
    
    const vitalsRef = doc(db, `Users/${patientId}/vitals_records`, dateStr);
    const snapshot = await getDoc(vitalsRef);

    if (snapshot.exists()) {
      console.log(`   ✓ Found vitals data - Converting all timestamps...`);
      const vitalsData = snapshot.data();
      
      const converted = convertAllTimestamps(vitalsData, 'vitalsRecord');
      console.log(`   ✓ Vitals conversion complete`);
      return converted;
    } else {
      console.log(`   ℹ️ No vitals data for ${dateStr}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching vitals records for ${dateStr}:`, error);
    return null;
  }
};


export const getCompleteDayData = async (patientId: string, dateStr: string) => {
  try {
    console.log(`\n📅 Getting complete daily data for ${patientId} on ${dateStr}`);

    const [medications, adherenceRecord, moodRecord, vitalsRecord] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
      getMoodRecordsForDate(patientId, dateStr),
      getVitalsRecordsForDate(patientId, dateStr),
    ]);

    console.log(`   ✓ Converting all timestamps to Date objects...`);
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
      medications: medicationsWithAdherence,
      adherenceRecord: convertedAdherenceRecord || null,
      vitals: convertedVitalsRecord || null,
      hasData: !!convertedAdherenceRecord || !!convertedMoodRecord || !!convertedVitalsRecord,
    };

    console.log(`   ✓ Final data structure for ${dateStr}:`, {
      mood: finalData.mood ? '✅ MOOD OBJECT' : '❌ null',
      medications: `✅ ARRAY[${finalData.medications.length}]`,
      adherenceRecord: finalData.adherenceRecord ? '✅ ADHERENCE OBJECT' : '❌ null',
      vitals: finalData.vitals ? '✅ VITALS OBJECT' : '❌ null',
    });
    console.log(`   ✓ All timestamps converted and compiled for ${dateStr}\n`);

    return finalData;
  } catch (error) {
    console.error('❌ Error getting complete day data:', error);
    return {
      date: dateStr,
      mood: null,
      medications: [],
      adherenceRecord: null,
      vitals: null,
      hasData: false,
    };
  }
};


export const getDayAdherenceData = async (patientId: string, dateStr: string) => {
  try {
    console.log(`\n🔍 Getting adherence data for ${patientId} on ${dateStr}`);

    const [medications, adherenceRecord] = await Promise.all([
      getPatientMedications(patientId),
      getAdherenceRecordsForDate(patientId, dateStr),
    ]);

    if (!medications || medications.length === 0) {
      console.log('   ℹ️ No medications found for this patient');
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

    console.log(`   ✓ Combined ${medicationsWithAdherence.length} medications with adherence data\n`);

    return {
      date: dateStr,
      medications: medicationsWithAdherence,
      adherenceRecord: adherenceRecord,
      hasData: !!adherenceRecord,
    };
  } catch (error) {
    console.error('❌ Error getting day adherence data:', error);
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

    console.log(`📊 Fetching mood logs for ${patientId} (${month + 1}/${year})`);

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

      console.log(`   ✓ Found ${logs.length} mood logs`);
      return logs;
    } catch (subcollectionError) {
      console.log('   ℹ️ No mood_logs subcollection found');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching mood logs:', error);
    return [];
  }
};


export const getAdherenceLogs = async (patientId: string, year: number, month: number): Promise<AdherenceLog[]> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    console.log(`💊 Fetching adherence logs for ${patientId} (${month + 1}/${year})`);

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

      console.log(`   ✓ Found ${logs.length} adherence logs`);
      return logs;
    } catch (subcollectionError) {
      console.log('   ℹ️ No adherence_logs subcollection found');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching adherence logs:', error);
    return [];
  }
};


export const getVitalsLogs = async (patientId: string, year: number, month: number): Promise<VitalsLog[]> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    console.log(`🏥 Fetching vitals logs for ${patientId} (${month + 1}/${year})`);

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

      console.log(`   ✓ Found ${logs.length} vitals logs`);
      return logs;
    } catch (subcollectionError) {
      console.log('   ℹ️ No vitals_logs subcollection found');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching vitals logs:', error);
    return [];
  }
};


export const getDailyLogs = async (patientId: string, year: number, month: number): Promise<Map<string, DailyLog>> => {
  try {
    console.log(`📅 Aggregating daily logs for ${patientId} (${month + 1}/${year})`);

    const moodLogs = await getMoodLogs(patientId, year, month);
    const adherenceLogs = await getAdherenceLogs(patientId, year, month);
    const vitalsLogs = await getVitalsLogs(patientId, year, month);

    const dailyLogsMap = new Map<string, DailyLog>();

    moodLogs.forEach((log) => {
      const dateStr = log.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!dailyLogsMap.has(dateStr)) {
        dailyLogsMap.set(dateStr, { date: dateStr });
      }
      const dailyLog = dailyLogsMap.get(dateStr)!;
      dailyLog.mood = log;
    });

    adherenceLogs.forEach((log) => {
      const dateStr = log.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
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
      const dateStr = log.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!dailyLogsMap.has(dateStr)) {
        dailyLogsMap.set(dateStr, { date: dateStr });
      }
      const dailyLog = dailyLogsMap.get(dateStr)!;
      if (!dailyLog.vitals || log.timestamp > dailyLog.vitals.timestamp) {
        dailyLog.vitals = log;
      }
    });

    console.log(`   ✓ Aggregated logs for ${dailyLogsMap.size} days`);
    return dailyLogsMap;
  } catch (error) {
    console.error('❌ Error aggregating daily logs:', error);
    return new Map();
  }
};
