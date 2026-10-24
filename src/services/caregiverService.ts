import { Patient } from '../types';
import { getAdherenceStats } from './adherenceService';
import { getActiveAdherenceRules } from './adherenceRulesService';
import {
  djangoGetCaregiverPatientSummary,
  djangoGetCaregiverProfile,
  djangoLinkCaregiverToNominations,
  djangoListCaregiverLinkedPatients,
  djangoPatchCaregiverProfile,
  djangoUnlinkCaregiverPatient,
  isDjangoApiEnabled,
} from './djangoApiService';

export type CaregiverPatientCategory = 'attention' | 'stable' | 'inactive';

export interface CaregiverPatientSummary {
  patient: Patient;
  adherenceRate: number;
  /** No medication activity logged in the last 30 days. */
  hasAdherenceData: boolean;
  category: CaregiverPatientCategory;
  needsAttention: boolean;
}

export type CaregiverLatestVitals = {
  recordedAt?: string;
  bloodPressure?: string;
  heartRate?: string;
  glucose?: string;
};

export type CaregiverUpcomingAppointment = {
  id: string;
  doctorName: string;
  startAt: string;
  status: string;
};

export type CaregiverPatientDetail = {
  patient: Patient;
  latestVitals: CaregiverLatestVitals | null;
  upcomingAppointments: CaregiverUpcomingAppointment[];
};

const toText = (value: unknown): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : String(value);

const toList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

function mapSummaryToDetail(row: Record<string, unknown>): CaregiverPatientDetail {
  const emergency = row.emergencyContact as { name?: string; phone?: string } | null | undefined;
  const dob = toText(row.dateOfBirth);
  const gender = toText(row.gender)?.toLowerCase();
  const vitals = row.latestVitals as Record<string, unknown> | null | undefined;
  const patient = {
    id: String(row.id ?? ''),
    role: 'patient',
    displayName: String(row.displayName ?? 'Patient'),
    email: String(row.email ?? ''),
    phoneNumber: toText(row.phoneNumber) ?? '',
    dateOfBirth: dob ? new Date(dob) : undefined,
    gender: gender === 'male' || gender === 'female' || gender === 'other' ? gender : undefined,
    chronicDiseases: toList(row.chronicConditions),
    allergies: toList(row.allergies),
    emergencyContact:
      emergency && (emergency.name || emergency.phone)
        ? {
            name: emergency.name ?? '',
            phone: emergency.phone ?? '',
            relationship: '',
          }
        : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Patient;
  return {
    patient,
    latestVitals: vitals
      ? {
          recordedAt: toText(vitals.recordedAt),
          bloodPressure: toText(vitals.bloodPressure),
          heartRate: toText(vitals.heartRate),
          glucose: toText(vitals.glucose),
        }
      : null,
    upcomingAppointments: Array.isArray(row.upcomingAppointments)
      ? (row.upcomingAppointments as Array<Record<string, unknown>>).map((a) => ({
          id: String(a.id),
          doctorName: String(a.doctorName ?? ''),
          startAt: String(a.startAt ?? ''),
          status: String(a.status ?? ''),
        }))
      : [],
  };
}

/** Picks up any warrior who nominated this caregiver's sign-in email. */
export const linkCaregiverToNominatedPatients = async (): Promise<number> => {
  if (!isDjangoApiEnabled()) return 0;
  return djangoLinkCaregiverToNominations();
};

export const fetchCaregiverPatientDetail = async (
  patientId: string,
): Promise<CaregiverPatientDetail | null> => {
  if (!isDjangoApiEnabled()) return null;
  const row = await djangoGetCaregiverPatientSummary(patientId);
  return row ? mapSummaryToDetail(row) : null;
};

export const fetchCaregiverPatient = async (patientId: string): Promise<Patient | null> => {
  const detail = await fetchCaregiverPatientDetail(patientId);
  return detail?.patient ?? null;
};

export type Unsubscribe = () => void;

export const listenToCaregiverPatients = (
  _caregiverId: string,
  onUpdate: (patients: Patient[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  let cancelled = false;
  (async () => {
    try {
      try {
        await linkCaregiverToNominatedPatients();
      } catch {
        // Linking is best effort; existing links still load below.
      }
      const rows = await djangoListCaregiverLinkedPatients();
      if (cancelled) return;
      const patients = await Promise.all(
        rows.map(async (row) => fetchCaregiverPatient(String(row.id ?? ''))),
      );
      if (!cancelled) onUpdate(patients.filter((p): p is Patient => Boolean(p)));
    } catch (err) {
      if (!cancelled) onError(err instanceof Error ? err : new Error('Failed to load patients'));
    }
  })();
  return () => {
    cancelled = true;
  };
};

/** The caregiver stops following a warrior; the warrior can re-nominate them later. */
export const revokeCaregiverPatientLink = async (patientId: string): Promise<void> => {
  await djangoUnlinkCaregiverPatient(patientId);
};

export const verifyCaregiverPatientAccess = async (patientId: string): Promise<boolean> => {
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
  const attentionBelow = getActiveAdherenceRules().attentionBelowPct;

  return Promise.all(
    patients.map(async (patient) => {
      let adherenceRate = 0;
      let hasAdherenceData = false;
      try {
        const stats = await getAdherenceStats(patient.id, from, to);
        hasAdherenceData = stats.totalDays > 0;
        adherenceRate = stats.averageAdherence;
      } catch {
        hasAdherenceData = false;
      }
      const category: CaregiverPatientCategory = !hasAdherenceData
        ? 'inactive'
        : adherenceRate < attentionBelow
          ? 'attention'
          : 'stable';
      return {
        patient,
        adherenceRate,
        hasAdherenceData,
        category,
        needsAttention: category === 'attention',
      };
    }),
  );
};

export type CaregiverProfileData = {
  id: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  caregiverTier: 'family' | 'professional';
  onboardingCompleted?: boolean;
  professionalCaregiverProfile?: {
    organization?: string;
    services?: string[];
    bio?: string;
    city?: string;
    province?: string;
    listingRequested?: boolean;
  };
  /** Anixi review of the Market listing request; null until one is requested. */
  marketListing?: {
    status: 'pending' | 'approved' | 'rejected';
    published: boolean;
    rejectionReason?: string;
  } | null;
};

function mapProfile(row: Record<string, unknown>): CaregiverProfileData {
  const pro = (row.professionalCaregiverProfile ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ''),
    displayName: toText(row.displayName),
    email: toText(row.email),
    phoneNumber: toText(row.phoneNumber),
    caregiverTier: row.caregiverTier === 'professional' ? 'professional' : 'family',
    onboardingCompleted: Boolean(row.onboardingCompleted),
    professionalCaregiverProfile: {
      organization: toText(pro.organization),
      services: toList(pro.services),
      bio: toText(pro.bio),
      city: toText(pro.city),
      province: toText(pro.province),
      listingRequested: Boolean(pro.listingRequested),
    },
    marketListing: mapMarketListing(row.marketListing),
  };
}

function mapMarketListing(raw: unknown): CaregiverProfileData['marketListing'] {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const status = row.status;
  if (status !== 'pending' && status !== 'approved' && status !== 'rejected') return null;
  return {
    status,
    published: Boolean(row.published),
    rejectionReason: toText(row.rejectionReason) || undefined,
  };
}

export const getCaregiverProfile = async (): Promise<CaregiverProfileData | null> => {
  if (!isDjangoApiEnabled()) return null;
  const row = await djangoGetCaregiverProfile();
  return row ? mapProfile(row) : null;
};

export const updateCaregiverProfile = async (updates: {
  displayName?: string;
  phoneNumber?: string;
  caregiverTier?: 'family' | 'professional';
  onboardingCompleted?: boolean;
  professionalCaregiverProfile?: CaregiverProfileData['professionalCaregiverProfile'];
}): Promise<CaregiverProfileData> => {
  const row = await djangoPatchCaregiverProfile(updates);
  return mapProfile(row);
};

