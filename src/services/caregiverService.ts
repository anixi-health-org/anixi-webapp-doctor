import { Patient } from '../types';
import { getAdherenceStats } from './adherenceService';
import {
  djangoListCaregiverLinkedPatients,
  djangoListWellnessProviders,
  isDjangoApiEnabled,
} from './djangoApiService';
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

export const linkCaregiverToNominatedPatients = async (
  _caregiverId: string,
  _caregiverEmail: string,
): Promise<number> => {
  return 0;
};

export const fetchCaregiverPatient = async (
  patientId: string,
): Promise<Patient | null> => {
  if (!isDjangoApiEnabled()) return null;
  const rows = await djangoListCaregiverLinkedPatients();
  const row = rows.find((entry) => String(entry.id) === patientId);
  if (!row) return null;
  return {
    id: patientId,
    role: 'patient',
    displayName: String(row.displayName ?? 'Patient'),
    email: String(row.email ?? ''),
    phoneNumber: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Patient;
};

export type Unsubscribe = () => void;

export const listenToCaregiverPatients = (
  caregiverId: string,
  onUpdate: (patients: Patient[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  let cancelled = false;
  (async () => {
    try {
      const rows = await djangoListCaregiverLinkedPatients();
      if (cancelled) return;
      const patients = await Promise.all(
        rows.map(async (row) => fetchCaregiverPatient(String(row.id ?? ''))),
      );
      onUpdate(patients.filter((p): p is Patient => Boolean(p)));
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to load patients'));
    }
  })();
  return () => {
    cancelled = true;
  };
};

export const revokeCaregiverPatientLink = async (
  _caregiverId: string,
  _patientId: string,
): Promise<void> => {
  // Backend revoke endpoint can be added later; link status managed server-side.
};

export const verifyCaregiverPatientAccess = async (
  _caregiverId: string,
  patientId: string,
): Promise<boolean> => {
  if (!isDjangoApiEnabled()) return false;
  const rows = await djangoListCaregiverLinkedPatients();
  return rows.some((row) => String(row.id) === patientId);
};

export const getCaregiverPatientSummaries = async (
  patients: Patient[],
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
      const needsAttention = adherenceRate > 0 && adherenceRate < 70;

      return { patient, adherenceRate, status, needsAttention };
    }),
  );

  return summaries;
};

export type CaregiverProfileData = {
  id: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  organization?: string;
  caregiverTier: 'family' | 'professional';
  professionalCaregiverProfile?: {
    organization?: string;
    services?: string[];
    bio?: string;
    city?: string;
    province?: string;
    published?: boolean;
    verified?: boolean;
  };
};

export const updateCaregiverProfile = async (
  _caregiverId: string,
  _updates: {
    displayName?: string;
    phoneNumber?: string;
    organization?: string;
    caregiverTier?: 'family' | 'professional';
    professionalCaregiverProfile?: CaregiverProfileData['professionalCaregiverProfile'];
  },
): Promise<void> => {
  // Persist via Django me patch when caregiver profile fields are expanded.
};

export const getCaregiverProfile = async (
  caregiverId: string,
): Promise<CaregiverProfileData | null> => {
  return {
    id: caregiverId,
    caregiverTier: 'family',
  };
};

export const listPublishedProfessionalCaregivers = async () => {
  try {
    return await djangoListWellnessProviders('caregiver');
  } catch {
    return [];
  }
};
