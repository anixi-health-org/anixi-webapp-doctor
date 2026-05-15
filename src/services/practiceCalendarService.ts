import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  PRACTICES_COLLECTION,
  PRACTICE_DAILY_SCHEDULE_SUBCOLLECTION,
} from '../shared/constants';
import type { PracticeDailySchedule } from '../types';



const toDate = (v: any): Date =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : new Date(v);



export const getPracticeDailySchedule = async (
  practiceId: string,
  date: string
): Promise<PracticeDailySchedule | null> => {
  const ref = doc(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_DAILY_SCHEDULE_SUBCOLLECTION,
    date
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    practiceId,
    date,
    availability: d.availability,
    openTime: d.openTime,
    closeTime: d.closeTime,
    note: d.note,
    updatedAt: toDate(d.updatedAt),
  };
};

export const setPracticeDailySchedule = async (
  schedule: Omit<PracticeDailySchedule, 'updatedAt'>
): Promise<void> => {
  const ref = doc(
    db,
    PRACTICES_COLLECTION,
    schedule.practiceId,
    PRACTICE_DAILY_SCHEDULE_SUBCOLLECTION,
    schedule.date
  );
  
  
  const data: any = {
    practiceId: schedule.practiceId,
    date: schedule.date,
    availability: schedule.availability,
    updatedAt: serverTimestamp(),
  };
  if (schedule.openTime !== undefined) data.openTime = schedule.openTime;
  if (schedule.closeTime !== undefined) data.closeTime = schedule.closeTime;
  if (schedule.note !== undefined) data.note = schedule.note;

  await setDoc(ref, data);
};

export const deletePracticeDailySchedule = async (
  practiceId: string,
  date: string
): Promise<void> => {
  const ref = doc(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_DAILY_SCHEDULE_SUBCOLLECTION,
    date
  );
  await deleteDoc(ref);
};