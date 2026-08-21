import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../../shared/constants';
import {
  APPROVED_PATIENTS_SUBCOLLECTION,
  APPROVED_SHARES_SUBCOLLECTION,
  INCOMING_SHARING_REQUESTS_SUBCOLLECTION,
  SHARING_REQUESTS_SUBCOLLECTION,
} from '../../shared/firestorePaths';

/**
 * The patient's copy of a request shares its id with the doctor's incoming
 * copy — both sides are written together when the request is raised. The
 * doctor may update that document but may not read the collection, so it has
 * to be addressed by id rather than found with a query.
 */
const patientRequestRef = (patientId: string, requestId: string) =>
  doc(db, USERS_COLLECTION, patientId, SHARING_REQUESTS_SUBCOLLECTION, requestId);

const mirrorRequestStatus = async (
  patientId: string,
  requestId: string,
  updates: { status: string; approvedAt?: ReturnType<typeof serverTimestamp> }
): Promise<void> => {
  try {
    await updateDoc(patientRequestRef(patientId, requestId), updates);
  } catch (error) {
    // A legacy request may not have a patient-side copy; the doctor-side
    // decision still stands.
    console.error('[sharing] could not mirror request status to patient', error);
  }
};

export const approveIncomingRequest = async (
  doctorId: string,
  requestId: string,
  patientId: string
): Promise<void> => {
  if (!doctorId || !requestId || !patientId) {
    throw new Error('Doctor ID, request ID, and patient ID are required');
  }

  const incomingRef = doc(
    db,
    USERS_COLLECTION,
    doctorId,
    INCOMING_SHARING_REQUESTS_SUBCOLLECTION,
    requestId
  );
  const incomingSnap = await getDoc(incomingRef);
  if (!incomingSnap.exists()) {
    throw new Error('Request not found');
  }

  const incomingData = incomingSnap.data();
  const resolvedPatientId = String(incomingData.patientId ?? patientId);
  const patientName = String(incomingData.patientName ?? 'Patient');

  let doctorName = 'Doctor';
  let doctorSpecialty: string | undefined;
  try {
    const doctorSnap = await getDoc(doc(db, DOCTORS_COLLECTION, doctorId));
    const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};
    doctorName =
      doctorData.displayName || doctorData.fullName || doctorData.name || 'Doctor';
    doctorSpecialty = doctorData.medicalSpecialty || doctorData.specialty;
  } catch {
    // Fall back to a generic name rather than blocking the approval.
  }

  // The doctor's own records commit together.
  const batch = writeBatch(db);
  batch.update(incomingRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
  });
  batch.set(
    doc(
      db,
      USERS_COLLECTION,
      doctorId,
      APPROVED_PATIENTS_SUBCOLLECTION,
      resolvedPatientId
    ),
    {
      patientId: resolvedPatientId,
      patientName,
      status: 'active',
      dataAccessScope: 'all',
      source: 'sharing_request',
      approvedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  // The patient-side mirror has to follow, not join, the batch above: writing
  // `approved_doctors` is only permitted once the roster entry already exists,
  // and rules see the pre-commit state of a batch.
  await setDoc(
    doc(
      db,
      USERS_COLLECTION,
      resolvedPatientId,
      APPROVED_SHARES_SUBCOLLECTION,
      doctorId
    ),
    {
      doctorId,
      doctorName,
      ...(doctorSpecialty ? { doctorSpecialty } : {}),
      approvedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, USERS_COLLECTION, resolvedPatientId, 'approved_doctors', doctorId),
    {
      doctorId,
      patientId: resolvedPatientId,
      status: 'active',
      acceptedAt: serverTimestamp(),
      dataAccessScope: 'all',
    },
    { merge: true }
  );

  await mirrorRequestStatus(resolvedPatientId, requestId, {
    status: 'approved',
    approvedAt: serverTimestamp(),
  });
};

export const rejectIncomingRequest = async (
  doctorId: string,
  requestId: string,
  patientId: string
): Promise<void> => {
  if (!doctorId || !requestId) {
    throw new Error('Doctor ID and request ID are required');
  }

  const incomingRef = doc(
    db,
    USERS_COLLECTION,
    doctorId,
    INCOMING_SHARING_REQUESTS_SUBCOLLECTION,
    requestId
  );
  const incomingSnap = await getDoc(incomingRef);
  const resolvedPatientId = incomingSnap.exists()
    ? String(incomingSnap.data()?.patientId ?? patientId)
    : patientId;

  await updateDoc(incomingRef, { status: 'revoked' });

  if (resolvedPatientId) {
    await mirrorRequestStatus(resolvedPatientId, requestId, {
      status: 'revoked',
    });
  }
};
