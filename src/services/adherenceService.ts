import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { getVitalsRecordsForDate } from './logsService';

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


export const getMonthlyAdherence = async (
  patientId: string,
  year: number,
  month: number
): Promise<Map<string, 'taken' | 'missed' | 'pending'>> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const adherenceRef = collection(
      db,
      USERS_COLLECTION,
      patientId,
      'adherence_records'
    );

    const q = query(
      adherenceRef,
      where('scheduledTime', '>=', startDate),
      where('scheduledTime', '<=', endDate)
    );

    const snapshot = await getDocs(q);
    const adherenceMap = new Map<string, 'taken' | 'missed' | 'pending'>();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const scheduledTime = data.scheduledTime?.toDate?.() || new Date(data.scheduledTime);
      const dateStr = scheduledTime.toISOString().split('T')[0];
      const status = data.status || 'pending';

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
    const adherenceRef = collection(
      db,
      USERS_COLLECTION,
      patientId,
      'adherence_records'
    );

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
      const scheduledTime = data.scheduledTime?.toDate?.() || new Date(data.scheduledTime);

      const hour = scheduledTime.getHours();
      let timeSlot: 'morning' | 'afternoon' | 'evening' = 'morning';
      if (hour >= 9 && hour < 17) timeSlot = 'afternoon';
      else if (hour >= 17 || hour < 1) timeSlot = 'evening';

      const record: AdherenceRecord = {
        date: date,
        medicationName: data.medicationName || 'Unknown',
        dosage: data.dosage,
        scheduledTime: data.scheduledTime,
        status: data.status || 'pending',
        takenTime: data.takenTime,
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
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
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


