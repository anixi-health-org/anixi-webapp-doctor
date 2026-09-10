import { isDjangoApiEnabled } from '../lib/runtimeConfig';
import { djangoCreateNotification } from './djangoApiService';

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
 * Writes a notification record for the patient.
 * Django path persists via the notifications API; the Firestore path has been removed.
 */
export const sendPatientNotification = async (
  patientId: string,
  payload: PatientNotificationPayload,
): Promise<void> => {
  if (!patientId || patientId === 'manual' || patientId === 'unknown') return;

  if (isDjangoApiEnabled()) {
    await djangoCreateNotification({
      type: payload.type,
      title: payload.title,
      body: payload.body,
      appointmentId: payload.appointmentId,
      userId: patientId,
    });
    return;
  }

  // Firestore path removed. No-op until migration.
  return;
};
