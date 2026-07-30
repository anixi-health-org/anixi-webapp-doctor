import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CareMessage {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  body: string;
  createdAt: Date;
}

const toDate = (value: unknown): Date => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

export const getDoctorCareMessages = async (doctorId: string): Promise<CareMessage[]> => {
  const ref = collection(db, 'Users', doctorId, 'care_messages');
  const q = query(ref, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      doctorId,
      patientId: String(data.patientId ?? ''),
      patientName: String(data.patientName ?? 'Patient'),
      body: String(data.body ?? ''),
      createdAt: toDate(data.createdAt),
    };
  });
};

export const getPatientCareMessages = async (
  doctorId: string,
  patientId: string
): Promise<CareMessage[]> => {
  const ref = collection(db, 'Users', doctorId, 'care_messages');
  const q = query(ref, where('patientId', '==', patientId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      doctorId,
      patientId: String(data.patientId ?? patientId),
      patientName: String(data.patientName ?? 'Patient'),
      body: String(data.body ?? ''),
      createdAt: toDate(data.createdAt),
    };
  });
};

export const sendCareMessage = async (
  doctorId: string,
  patientId: string,
  patientName: string,
  body: string
): Promise<string> => {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length < 2) throw new Error('Message is too short');

  const ref = collection(db, 'Users', doctorId, 'care_messages');
  const docRef = await addDoc(ref, {
    patientId,
    patientName,
    body: trimmed,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};
