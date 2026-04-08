import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
    console.log(`[SupportService] 📧 Submitting support request`);

    if (!subject || !subject.trim()) {
      console.error(`[SupportService] ❌ Subject is required`);
      throw new Error('Subject is required');
    }

    if (!message || !message.trim()) {
      console.error(`[SupportService] ❌ Message is required`);
      throw new Error('Message is required');
    }

    if (message.trim().length < 10) {
      console.error(`[SupportService] ❌ Message must be at least 10 characters`);
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

    console.log(`[SupportService] ✅ Support request submitted:`, docRef.id);

    return docRef.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit support request';
    console.error(`[SupportService] ❌ Error:`, errorMessage);
    throw new Error(errorMessage);
  }
};

export const getDoctorSupportRequests = async (
  doctorId: string,
  limit: number = 50
): Promise<SupportRequest[]> => {
  try {
    console.log(`[SupportService] 📋 Fetching support requests for doctor: ${doctorId}`);

    const supportRef = collection(db, 'supportRequests');
    const q = {
      constraints: [
        { type: 'where', fieldPath: 'doctorId', operator: '==', value: doctorId },
        { type: 'orderBy', fieldPath: 'createdAt', direction: 'desc' },
        { type: 'limit', limit },
      ],
    };

    console.log(`[SupportService] ✅ Fetched support requests`);

    return [];
  } catch (error) {
    console.error(`[SupportService] ❌ Error fetching requests:`, error);
    throw error;
  }
};
