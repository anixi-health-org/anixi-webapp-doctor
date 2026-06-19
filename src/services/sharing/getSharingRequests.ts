import {
  collection,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { USERS_COLLECTION } from '../../shared/constants';
import { INCOMING_SHARING_REQUESTS_SUBCOLLECTION, SHARING_REQUESTS_SUBCOLLECTION } from '../../shared/firestorePaths';
import { sharingTimestampToDate } from './searchDoctors';
import { IncomingSharingRequest, PatientSharingRequest } from './types';

export const getPatientSharingRequests = async (
  patientId: string
): Promise<PatientSharingRequest[]> => {
  if (!patientId) return [];
  const ref = collection(db, USERS_COLLECTION, patientId, SHARING_REQUESTS_SUBCOLLECTION);
  const snapshot = await getDocs(ref);
  return snapshot.docs.map(mapPatientSharingRequest);
};

export const getIncomingSharingRequests = async (
  doctorId: string
): Promise<IncomingSharingRequest[]> => {
  if (!doctorId) return [];
  const ref = collection(db, USERS_COLLECTION, doctorId, INCOMING_SHARING_REQUESTS_SUBCOLLECTION);
  const q = query(ref, where('status', '==', 'pending'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapIncomingSharingRequest);
};

export const listenToIncomingSharingRequests = (
  doctorId: string,
  onUpdate: (requests: IncomingSharingRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!doctorId) {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }

  const ref = collection(db, USERS_COLLECTION, doctorId, INCOMING_SHARING_REQUESTS_SUBCOLLECTION);
  const q = query(ref, where('status', '==', 'pending'));

  return onSnapshot(
    q,
    (snapshot) => {
      onUpdate(snapshot.docs.map(mapIncomingSharingRequest));
    },
    (err) => onError(err instanceof Error ? err : new Error('Failed to load requests'))
  );
};

export const listenToPatientSharingRequests = (
  patientId: string,
  onUpdate: (requests: PatientSharingRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!patientId) {
    onError(new Error('Patient ID is required'));
    return () => {};
  }

  const ref = collection(db, USERS_COLLECTION, patientId, SHARING_REQUESTS_SUBCOLLECTION);
  return onSnapshot(
    ref,
    (snapshot) => {
      onUpdate(snapshot.docs.map(mapPatientSharingRequest));
    },
    (err) => onError(err instanceof Error ? err : new Error('Failed to load requests'))
  );
};

function mapPatientSharingRequest(docSnap: { id: string; data: () => Record<string, unknown> }): PatientSharingRequest {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    doctorId: String(data.doctorId ?? ''),
    doctorName: String(data.doctorName ?? 'Doctor'),
    doctorSpecialty: data.doctorSpecialty as string | undefined,
    doctorCity: data.doctorCity as string | undefined,
    doctorYearsInPractice: data.doctorYearsInPractice as number | undefined,
    status: (data.status as PatientSharingRequest['status']) || 'pending',
    createdAt: sharingTimestampToDate(data.createdAt),
    approvedAt: data.approvedAt ? sharingTimestampToDate(data.approvedAt) : undefined,
  };
}

function mapIncomingSharingRequest(docSnap: { id: string; data: () => Record<string, unknown> }): IncomingSharingRequest {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    patientId: String(data.patientId ?? ''),
    patientName: String(data.patientName ?? 'Patient'),
    status: (data.status as IncomingSharingRequest['status']) || 'pending',
    createdAt: sharingTimestampToDate(data.createdAt),
    approvedAt: data.approvedAt ? sharingTimestampToDate(data.approvedAt) : undefined,
  };
}
