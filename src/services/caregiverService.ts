import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { Patient } from '../types';
import { getAdherenceStats } from './adherenceService';
import { getPatientStatus } from './patientManagementService';

export interface LinkedPatientRecord {
  patientId: string;
  linkedAt: Date;
  status: 'active' | 'pending';
  patientDisplayName?: string;
  patientEmail?: string;
}

export interface CaregiverPatientSummary {
  patient: Patient;
  adherenceRate: number;
  status: ReturnType<typeof getPatientStatus>;
  needsAttention: boolean;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const mapPatientDoc = (patientId: string, data: Record<string, unknown>): Patient => ({
  id: patientId,
  email: (data.email as string) || '',
  displayName: (data.fullName as string) || (data.displayName as string) || 'Patient',
  role: 'patient',
  dateOfBirth:
    (data.dateOfBirth as { toDate?: () => Date })?.toDate?.() ||
    (data.dateOfBirth as Date | undefined) ||
    undefined,
  gender: data.gender as Patient['gender'],
  phoneNumber: data.phoneNumber as string | undefined,
  chronicDiseases: (data.chronicDiseases as string[]) || [],
  allergies: (data.allergies as string[]) || [],
  emergencyContact: data.emergencyContact as Patient['emergencyContact'],
  createdAt:
    (data.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
  updatedAt:
    (data.updatedAt as { toDate?: () => Date })?.toDate?.() || new Date(),
});

export const linkCaregiverToNominatedPatients = async (
  caregiverId: string,
  caregiverEmail: string
): Promise<number> => {
  const email = normalizeEmail(caregiverEmail);
  if (!email) return 0;

  const patientsQuery = query(
    collection(db, 'patients'),
    where('hasCaregiver', '==', true),
    where('caregiverEmail', '==', email)
  );

  const snapshot = await getDocs(patientsQuery);
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  let linked = 0;

  snapshot.docs.forEach((patientDoc) => {
    const data = patientDoc.data();
    const linkRef = doc(db, USERS_COLLECTION, caregiverId, 'linked_patients', patientDoc.id);
    batch.set(
      linkRef,
      {
        patientId: patientDoc.id,
        status: 'active',
        patientDisplayName: data.fullName || data.displayName || 'Patient',
        patientEmail: data.email || '',
        linkedAt: serverTimestamp(),
      },
      { merge: true }
    );

    batch.update(patientDoc.ref, {
      caregiverId,
      updatedAt: serverTimestamp(),
    });
    linked += 1;
  });

  await batch.commit();
  return linked;
};

export const fetchCaregiverPatient = async (patientId: string): Promise<Patient | null> => {
  const snap = await getDoc(doc(db, 'patients', patientId));
  if (!snap.exists()) return null;
  return mapPatientDoc(snap.id, snap.data() as Record<string, unknown>);
};

export const listenToCaregiverPatients = (
  caregiverId: string,
  onUpdate: (patients: Patient[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const linksRef = collection(db, USERS_COLLECTION, caregiverId, 'linked_patients');

  return onSnapshot(
    linksRef,
    async (snapshot) => {
      try {
        const activeLinks = snapshot.docs.filter(
          (d) => (d.data().status as string | undefined) !== 'inactive'
        );

        if (activeLinks.length === 0) {
          onUpdate([]);
          return;
        }

        const patients = await Promise.all(
          activeLinks.map(async (linkDoc) => {
            const patientId = (linkDoc.data().patientId as string) || linkDoc.id;
            return fetchCaregiverPatient(patientId);
          })
        );

        onUpdate(patients.filter((p): p is Patient => p !== null));
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Failed to load patients'));
      }
    },
    (err) => onError(err)
  );
};

export const verifyCaregiverPatientAccess = async (
  caregiverId: string,
  patientId: string
): Promise<boolean> => {
  const linkRef = doc(db, USERS_COLLECTION, caregiverId, 'linked_patients', patientId);
  const snap = await getDoc(linkRef);
  return snap.exists() && snap.data()?.status !== 'inactive';
};

export const getCaregiverPatientSummaries = async (
  patients: Patient[]
): Promise<CaregiverPatientSummary[]> => {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const from = thirtyDaysAgo.toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];

  const summaries = await Promise.all(
    patients.map(async (patient) => {
      let adherenceRate = 0;
      try {
        const stats = await getAdherenceStats(patient.id, from, to);
        adherenceRate = stats.averageAdherence;
      } catch {
        adherenceRate = 0;
      }

      const status = getPatientStatus(patient);
      const needsAttention =
        status === 'warning' ||
        status === 'inactive' ||
        adherenceRate < 70 ||
        (patient.chronicDiseases?.length ?? 0) > 0;

      return { patient, adherenceRate, status, needsAttention };
    })
  );

  return summaries;
};

export const updateCaregiverProfile = async (
  caregiverId: string,
  updates: { displayName?: string; phoneNumber?: string; organization?: string }
): Promise<void> => {
  const userRef = doc(db, USERS_COLLECTION, caregiverId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getCaregiverProfile = async (caregiverId: string) => {
  const snap = await getDoc(doc(db, USERS_COLLECTION, caregiverId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: caregiverId,
    displayName: data.displayName as string | undefined,
    email: data.email as string | undefined,
    phoneNumber: data.phoneNumber as string | undefined,
    organization: data.organization as string | undefined,
  };
};
