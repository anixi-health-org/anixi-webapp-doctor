import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../../shared/constants';
import {
  INCOMING_SHARING_REQUESTS_SUBCOLLECTION,
  SHARING_REQUESTS_SUBCOLLECTION,
} from '../../shared/firestorePaths';

export interface CreateSharingRequestInput {
  patientId: string;
  doctorId: string;
}

export const createSharingRequest = async (
  input: CreateSharingRequestInput
): Promise<string> => {
  const { patientId, doctorId } = input;
  if (!patientId?.trim()) throw new Error('Patient ID is required');
  if (!doctorId?.trim()) throw new Error('Doctor ID is required');

  const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
  const doctorSnap = await getDoc(doctorRef);
  if (!doctorSnap.exists()) {
    throw new Error('Doctor not found');
  }
  const doctorData = doctorSnap.data();

  const patientRef = doc(db, USERS_COLLECTION, patientId);
  const patientSnap = await getDoc(patientRef);
  const patientData = patientSnap.exists() ? patientSnap.data() : {};
  const patientName =
    patientData.displayName || patientData.fullName || patientData.name || 'Patient';

  const existingPatientReqs = query(
    collection(db, USERS_COLLECTION, patientId, SHARING_REQUESTS_SUBCOLLECTION),
    where('doctorId', '==', doctorId),
    where('status', '==', 'pending')
  );
  const existingSnap = await getDocs(existingPatientReqs);
  if (!existingSnap.empty) {
    throw new Error('You have already sent a request to this doctor');
  }

  const patientCopyRef = doc(
    collection(db, USERS_COLLECTION, patientId, SHARING_REQUESTS_SUBCOLLECTION)
  );
  const requestId = patientCopyRef.id;

  const doctorCopyRef = doc(
    db,
    USERS_COLLECTION,
    doctorId,
    INCOMING_SHARING_REQUESTS_SUBCOLLECTION,
    requestId
  );

  const doctorName =
    doctorData.displayName || doctorData.fullName || doctorData.name || 'Doctor';
  const doctorSpecialty = doctorData.medicalSpecialty || doctorData.specialty;
  const doctorCity = doctorData.practiceCity || doctorData.city;
  const doctorYearsInPractice =
    doctorData.yearsInPractice ?? doctorData.yearsOfExperience;

  const batch = writeBatch(db);

  batch.set(patientCopyRef, {
    doctorId,
    doctorName,
    ...(doctorSpecialty ? { doctorSpecialty } : {}),
    ...(doctorCity ? { doctorCity } : {}),
    ...(doctorYearsInPractice != null ? { doctorYearsInPractice } : {}),
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  batch.set(doctorCopyRef, {
    patientId,
    patientName,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return requestId;
};
