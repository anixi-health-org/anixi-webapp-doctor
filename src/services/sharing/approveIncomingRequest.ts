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
  APPROVED_PATIENTS_SUBCOLLECTION,
  APPROVED_SHARES_SUBCOLLECTION,
  INCOMING_SHARING_REQUESTS_SUBCOLLECTION,
  SHARING_REQUESTS_SUBCOLLECTION,
} from '../../shared/firestorePaths';

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

  const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
  const doctorSnap = await getDoc(doctorRef);
  const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};
  const doctorName =
    doctorData.displayName || doctorData.fullName || doctorData.name || 'Doctor';
  const doctorSpecialty = doctorData.medicalSpecialty || doctorData.specialty;

  const batch = writeBatch(db);

  batch.update(incomingRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
  });

  const patientPendingQuery = query(
    collection(db, USERS_COLLECTION, resolvedPatientId, SHARING_REQUESTS_SUBCOLLECTION),
    where('doctorId', '==', doctorId),
    where('status', '==', 'pending')
  );
  const patientPendingSnap = await getDocs(patientPendingQuery);
  patientPendingSnap.docs.forEach((patientReqDoc) => {
    batch.update(patientReqDoc.ref, {
      status: 'approved',
      approvedAt: serverTimestamp(),
    });
  });

  const approvedShareRef = doc(
    db,
    USERS_COLLECTION,
    resolvedPatientId,
    APPROVED_SHARES_SUBCOLLECTION,
    doctorId
  );
  batch.set(approvedShareRef, {
    doctorId,
    doctorName,
    ...(doctorSpecialty ? { doctorSpecialty } : {}),
    approvedAt: serverTimestamp(),
  });

  const approvedPatientRef = doc(
    db,
    USERS_COLLECTION,
    doctorId,
    APPROVED_PATIENTS_SUBCOLLECTION,
    resolvedPatientId
  );
  batch.set(approvedPatientRef, {
    patientId: resolvedPatientId,
    patientName,
    approvedAt: serverTimestamp(),
  });

  // Legacy mirror for health-data rules that still check approved_doctors
  const approvedDoctorRef = doc(
    db,
    USERS_COLLECTION,
    resolvedPatientId,
    'approved_doctors',
    doctorId
  );
  batch.set(
    approvedDoctorRef,
    {
      doctorId,
      patientId: resolvedPatientId,
      status: 'active',
      acceptedAt: serverTimestamp(),
      dataAccessScope: 'all',
    },
    { merge: true }
  );

  await batch.commit();
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

  const batch = writeBatch(db);

  batch.update(incomingRef, {
    status: 'revoked',
  });

  if (resolvedPatientId) {
    const patientPendingQuery = query(
      collection(db, USERS_COLLECTION, resolvedPatientId, SHARING_REQUESTS_SUBCOLLECTION),
      where('doctorId', '==', doctorId),
      where('status', '==', 'pending')
    );
    const patientPendingSnap = await getDocs(patientPendingQuery);
    patientPendingSnap.docs.forEach((patientReqDoc) => {
      batch.update(patientReqDoc.ref, {
        status: 'revoked',
      });
    });
  }

  await batch.commit();
};
