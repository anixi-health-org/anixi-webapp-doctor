import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';

export type PatientNotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'booking_reminder'
  | 'invoice_resent'
  | 'appointment_completed'
  | 'no_show'
  | 'auto_cancelled'
  | 'medical_document'
  | 'doctor_message'
  | 'teleconsult_reminder';

export interface PatientNotificationPayload {
  type: PatientNotificationType;
  title: string;
  body: string;
  appointmentId: string;
  doctorId: string;
}

/**
 * Writes a notification record to the patient's notifications subcollection.
 * Uses a deterministic id so reconnects and dual writers do not duplicate.
 */
export const sendPatientNotification = async (
  patientId: string,
  payload: PatientNotificationPayload
): Promise<void> => {
  if (!patientId || patientId === 'manual' || patientId === 'unknown') return;
  const notificationId = `${payload.appointmentId}_${payload.type}`;
  const notifRef = doc(
    db,
    USERS_COLLECTION,
    patientId,
    'notifications',
    notificationId
  );
  await setDoc(
    notifRef,
    {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};
