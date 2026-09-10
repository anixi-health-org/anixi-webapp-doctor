import { Patient } from '../types';
import { getAdherenceStats } from './adherenceService';
import { djangoListWellnessProviders } from './djangoApiService';
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
  caregiverId: string,
  caregiverEmail: string,
): Promise<number> => {
  // Persisted via Django registration; no Firestore side-effect needed.
  return 0;
};

export const fetchCaregiverPatient = async (
  patientId: string,
): Promise<Patient | null> => {
  // TODO: replace with a Django patient endpoint once available.
  return null;
};

export type Unsubscribe = () => void;

export const listenToCaregiverPatients = (
  _caregiverId: string,
  onUpdate: (patients: Patient[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  onUpdate([]);
  return () => {};
};

export const revokeCaregiverPatientLink = async (
  _caregiverId: string,
  _patientId: string,
): Promise<void> => {
  // TODO: replace with a Django revoke endpoint once available.
};

export const verifyCaregiverPatientAccess = async (
  _caregiverId: string,
  _patientId: string,
): Promise<boolean> => {
  // TODO: replace with a Django access-check endpoint once available.
  return false;
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
      const needsAttention =
        status === 'warning' ||
        status === 'inactive' ||
        adherenceRate < 70 ||
        (patient.chronicDiseases?.length ?? 0) > 0;

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
  // TODO: persist via Django caregiver profile endpoint once available.
};

export const getCaregiverProfile = async (
  caregiverId: string,
): Promise<CaregiverProfileData | null> => {
  // TODO: replace with a Django caregiver profile endpoint once available.
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
