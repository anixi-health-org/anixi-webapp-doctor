import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
export interface SupportRequest {
  id: string;
  doctorId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  response?: string;
  respondedAt?: Date;
}
export const submitSupportRequest = async (
  doctorId: string,
  subject: string,
  message: string
): Promise<string> => {
  try {
    if (!subject || !subject.trim()) {
      ;
      throw new Error('Subject is required');
    }
    if (!message || !message.trim()) {
      ;
      throw new Error('Message is required');
    }
    if (message.trim().length < 10) {
      ;
      throw new Error('Message must be at least 10 characters');
    }
    const supportRef = collection(db, 'supportRequests');
    const docRef = await addDoc(supportRef, {
      doctorId,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
      priority: 'medium',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit support request';
    ;
    throw new Error(errorMessage);
  }
};
export const getDoctorSupportRequests = async (
  doctorId: string,
  maxResults: number = 50
): Promise<SupportRequest[]> => {
  const supportRef = collection(db, 'supportRequests');
  const q = query(
    supportRef,
    where('doctorId', '==', doctorId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const toDate = (value: unknown): Date => {
      if (value instanceof Timestamp) return value.toDate();
      if (value instanceof Date) return value;
      return new Date();
    };
    return {
      id: docSnap.id,
      doctorId: data.doctorId,
      subject: data.subject,
      message: data.message,
      status: data.status,
      priority: data.priority,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      response: data.response,
      respondedAt: data.respondedAt ? toDate(data.respondedAt) : undefined,
    };
  });
};
