import {
  addDoc,
  collection,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { convertTimestamp } from '../utils/dateFormatter';

export interface PatientActivityEntry {
  id: string;
  patientId: string;
  appointmentId: string | null;
  actionType: string;
  description: string;
  createdAt: Date | null;
}

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

/** Live feed of the activity this doctor's actions have recorded. */
export const listenToRecentPatientActivity = (
  doctorId: string,
  entryLimit: number,
  onUpdate: (entries: PatientActivityEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  if (!doctorId) {
    onUpdate([]);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(db, USERS_COLLECTION, doctorId, 'patient_activity'),
      orderBy('createdAt', 'desc'),
      limitTo(entryLimit)
    ),
    (snapshot) => {
      onUpdate(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            patientId: String(data.patientId ?? ''),
            appointmentId: data.appointmentId ? String(data.appointmentId) : null,
            actionType: String(data.actionType ?? ''),
            description: String(data.description ?? ''),
            createdAt: convertTimestamp(data.createdAt),
          };
        })
      );
    },
    (error) => {
      console.error('Error listening to patient activity:', error);
      onError?.(error);
    }
  );
};
