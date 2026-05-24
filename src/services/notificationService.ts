import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';

export type PatientNotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder';

export interface PatientNotificationPayload {
  type: PatientNotificationType;
  title: string;
  body: string;
  appointmentId: string;
  doctorId: string;
}

/**
 * Writes a notification record to the patient's notifications subcollection.
 * The patient app reads from Users/{patientId}/notifications.
 * Skips silently for manual bookings (no Anixi account).
 */
export const sendPatientNotification = async (
  patientId: string,
  payload: PatientNotificationPayload
): Promise<void> => {
  if (!patientId || patientId === 'manual' || patientId === 'unknown') return;
  const notifRef = collection(db, USERS_COLLECTION, patientId, 'notifications');
  await addDoc(notifRef, {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
};
