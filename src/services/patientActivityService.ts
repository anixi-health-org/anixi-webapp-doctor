import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';

interface LogPatientActivityInput {
  doctorId: string;
  patientId: string;
  appointmentId?: string;
  actionType: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const normalizeMetadata = (
  metadata?: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean | null> | undefined => {
  if (!metadata) return undefined;

  const normalized: Record<string, string | number | boolean | null> = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined) return;
    normalized[key] = value;
  });
  return normalized;
};

export const logPatientActivity = async ({
  doctorId,
  patientId,
  appointmentId,
  actionType,
  description,
  metadata,
}: LogPatientActivityInput): Promise<void> => {
  if (!doctorId || !patientId || !actionType || !description) return;

  try {
    const activityRef = collection(db, USERS_COLLECTION, doctorId, 'patient_activity');
    const normalizedMetadata = normalizeMetadata(metadata);

    await addDoc(activityRef, {
      doctorId,
      patientId,
      appointmentId: appointmentId || null,
      scope: appointmentId ? 'appointment' : 'general',
      actionType,
      description,
      metadata: normalizedMetadata || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Failed to log patient activity', error);
  }
};
