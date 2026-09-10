import { buildPatientSignupLink } from '../lib/referralLinks';
import { Patient, SharingRequest } from '../types';
import { mapPatientRecord } from './patientRecordMapper';
import {
  djangoCreateSharingRequest,
  djangoGetPatientChart,
  djangoImportRoster,
  djangoListPatientPanel,
  djangoListSharingRequests,
  djangoResolveSharing,
  isDjangoApiEnabled,
} from './djangoApiService';

export const sendPatientDownloadInvite = async (opts: {
  doctorId: string;
  to: string;
  patientDisplayName?: string;
}): Promise<void> => {
  // TODO: route invite email via Django transactional-email endpoint once available.
  const signupLink = buildPatientSignupLink();
  console.log(
    `[patientManagementService] sendPatientDownloadInvite stub — to=${opts.to} signupLink=${signupLink}`,
  );
};

/** Keeps doctor portal + mobile permission models in sync for health data reads. */
export const linkDoctorPatientAccess = async (
  _doctorId: string,
  _patientId: string,
): Promise<void> => {
  // TODO: persist patient-doctor link via Django sharing endpoint once available.
};

export type Unsubscribe = () => void;

async function loadPatientRecordForDoctor(
  doctorId: string,
  patientId: string,
): Promise<Patient | null> {
  if (!isDjangoApiEnabled()) return null;

  try {
    const panel = await djangoListPatientPanel();
    const row = panel.find((entry) => entry.patientId === patientId);
    if (row) {
      return mapPatientRecord(
        patientId,
        undefined,
        { displayName: row.displayName || 'Patient', email: row.email || '' },
        doctorId,
      );
    }
  } catch {
    return null;
  }

  try {
    const chart = await djangoGetPatientChart(patientId);
    if (!chart) return null;
    const profile = (chart.profile as Record<string, unknown> | undefined) ?? {};
    return mapPatientRecord(
      patientId,
      undefined,
      {
        displayName: String(profile.fullName ?? profile.displayName ?? 'Patient'),
        email: String(profile.email ?? ''),
      },
      doctorId,
    );
  } catch {
    return null;
  }
}

/**
 * Build the portal's view of a rostered patient.
 *
 * Once the Firestore reads are gone, the rostered patient view comes from the
 * Django patient-panel / patient-chart endpoints.
 */
export const resolveRosteredPatient = async (
  doctorId: string,
  patientId: string,
  _rosterData?: Record<string, unknown>,
): Promise<Patient | null> => {
  return loadPatientRecordForDoctor(doctorId, patientId);
};

/** Resolve a patient for the doctor portal, including booked patients not yet on the roster. */
export const getPatientForDoctorView = async (
  doctorId: string,
  patientId: string,
  options?: {
    patientName?: string;
    patientEmail?: string;
    ensureAccess?: boolean;
  },
): Promise<Patient | null> => {
  if (!doctorId?.trim() || !patientId?.trim()) return null;
  if (
    patientId === 'manual' ||
    patientId === 'unknown' ||
    patientId.startsWith('manual_')
  ) {
    return null;
  }

  const linked = await loadPatientRecordForDoctor(doctorId, patientId);
  if (linked) return linked;

  if (options?.ensureAccess) {
    return null;
  }

  return null;
};

export const getDoctorPatients = async (doctorId: string): Promise<Patient[]> => {
  if (isDjangoApiEnabled()) {
    try {
      const panel = await djangoListPatientPanel();
      return panel.map((row) => ({
        id: row.patientId,
        email: row.email,
        displayName: row.displayName || 'Patient',
        role: 'patient' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch {
      return [];
    }
  }

  // Firestore roster path removed.
  return [];
};
export interface PatientRequest {
  id: string;
  patientId: string;
  doctorId: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: Date;
  respondedAt?: Date;
  patientInfo?: Patient;
}
export const getDoctorPatientRequests = async (
  _doctorId: string,
): Promise<PatientRequest[]> => {
  // TODO: replace with a Django patient-request endpoint once available.
  return [];
};
export const debugListAllPatientRequests = async (
  _doctorId: string,
): Promise<void> => {
  // No-op until the debug helper has a Django target.
};
export const acceptPatientRequest = async (
  doctorId: string,
  requestId: string,
  patientId: string,
): Promise<void> => {
  await linkDoctorPatientAccess(doctorId, patientId);
  // TODO: persist acceptance via Django patient-request endpoint once available.
};
export const rejectPatientRequest = async (
  _doctorId: string,
  requestId: string,
): Promise<void> => {
  // TODO: persist rejection via Django patient-request endpoint once available.
};
export const sendPatientRequest = async (
  patientId: string,
  doctorId: string,
): Promise<string> => {
  if (!patientId || patientId.trim() === '') {
    throw new Error('Patient ID is required');
  }
  if (!doctorId || doctorId.trim() === '') {
    throw new Error('Doctor ID is required');
  }
  // TODO: persist via Django patient-request endpoint once available.
  return `patient-request-${Date.now()}`;
};export const calculateAge = (dateOfBirth: Date | undefined | null): number | null => {
  if (!dateOfBirth) return null;
  try {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return null;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
};

export type PatientRosterStatus = 'stable' | 'critical' | 'recovering' | 'inactive';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Same roster status as the Patients page, not adherence or 5-day recency. */
export function derivePatientRosterStatus(patient: Patient): PatientRosterStatus {
  const chronicCount = patient.chronicDiseases?.length ?? 0;
  if (chronicCount > 2) return 'critical';
  if (chronicCount > 0) return 'recovering';
  const lastRaw = patient.updatedAt ?? patient.createdAt;
  const last = lastRaw ? new Date(lastRaw) : null;
  if (last && !Number.isNaN(last.getTime()) && last.getTime() < Date.now() - THIRTY_DAYS_MS) {
    return 'inactive';
  }
  return 'stable';
}

export const getPatientStatus = (patient: Patient): 'stable' | 'warning' | 'inactive' => {
  const status = derivePatientRosterStatus(patient);
  if (status === 'inactive') return 'inactive';
  if (status === 'critical' || status === 'recovering') return 'warning';
  return 'stable';
};

export const addPatientManually = async (
  doctorId: string,
  payload: {
    displayName: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    notes?: string;
    /** When set, patient joins the practice-shared pool */
    practiceId?: string;
  },
  inviteOptions?: { sendInvite?: boolean; inviteEmail?: string },
): Promise<{ patientId: string; inviteQueued?: boolean; inviteMailId?: string; inviteError?: string }> => {
  if (!doctorId) throw new Error('Doctor ID is required');
  const targetEmail = (inviteOptions?.inviteEmail || payload.email || '').trim().toLowerCase();

  if (isDjangoApiEnabled()) {
    await djangoImportRoster(
      [
        {
          name: payload.displayName,
          email: payload.email,
          phone: payload.phoneNumber,
          notes: payload.notes,
          practiceId: payload.practiceId,
        },
      ],
      payload.practiceId,
    );

    const panel = await djangoListPatientPanel();
    const match = panel.find(
      (row) => targetEmail && row.email.trim().toLowerCase() === targetEmail,
    );
    const patientId = match?.patientId ?? `pending-${Date.now()}`;

    if (inviteOptions?.sendInvite && targetEmail) {
      console.log(
        `[patientManagementService] Roster import complete — invite email for ${targetEmail} not yet automated`,
      );
    }

    return { patientId, inviteQueued: Boolean(inviteOptions?.sendInvite && targetEmail) };
  }

  const patientId = `patient-${Date.now()}`;
  return { patientId };
};

export type PatientUpdatePayload = Partial<
  Omit<Patient, 'id' | 'role' | 'createdAt' | 'updatedAt'> & { notes?: string }
>;

export const updatePatient = async (
  _patientId: string,
  _updates: PatientUpdatePayload,
): Promise<void> => {
  if (!_patientId || _patientId.trim() === '') {
    throw new Error('Patient ID is required to update patient');
  }
  if (!_updates || Object.keys(_updates).length === 0) {
    throw new Error('No update values provided');
  }
  // TODO: persist via Django patient endpoint once available.
};

export const removePatientFromDoctor = async (
  doctorId: string,
  patientId: string,
): Promise<void> => {
  if (!doctorId || doctorId.trim() === '') {
    throw new Error('Doctor ID is required');
  }
  if (!patientId || patientId.trim() === '') {
    throw new Error('Patient ID is required');
  }
  await linkDoctorPatientAccess(doctorId, patientId);
  // TODO: persist removal via Django patient endpoint once available.
};

export const getDoctorSharingRequests = async (doctorId: string): Promise<SharingRequest[]> => {
  if (isDjangoApiEnabled()) {
    try {
      const rows = await djangoListSharingRequests('clinician');
      return rows.map((row) => ({
        id: String(row.id),
        patientId: String(row.patientId ?? ''),
        doctorId,
        requestedDataTypes: ['all'],
        status: (row.status as SharingRequest['status']) || 'pending',
        reason: typeof row.message === 'string' ? row.message : undefined,
        createdAt: new Date(),
      }));
    } catch {
      return [];
    }
  }

  // Firestore sharing-requests path removed.
  return [];
};

export const getPatientsWithSharingRequests = async (
  doctorId: string,
): Promise<Map<string, SharingRequest[]>> => {
  const sharingRequests = await getDoctorSharingRequests(doctorId);
  const patientMap = new Map<string, SharingRequest[]>();

  sharingRequests.forEach((req) => {
    if (!patientMap.has(req.patientId)) {
      patientMap.set(req.patientId, []);
    }
    patientMap.get(req.patientId)!.push(req);
  });

  return patientMap;
};

export const acceptSharingRequest = async (
  patientId: string,
  doctorId: string,
  requestId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoResolveSharing(requestId, 'approved');
    return;
  }

  await linkDoctorPatientAccess(doctorId, patientId);
  // TODO: persist approval via Django sharing endpoint once available.
};

export const rejectSharingRequest = async (
  _patientId: string,
  doctorId: string,
  requestId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoResolveSharing(requestId, 'rejected');
    return;
  }
  // TODO: persist rejection via Django sharing endpoint once available.
};

export const sendSharingRequest = async (
  patientId: string,
  doctorId: string,
  reason?: string,
  requestedDataTypes?: string[],
): Promise<string> => {
  if (!patientId || patientId.trim() === '') {
    throw new Error('Patient ID is required');
  }
  if (!doctorId || doctorId.trim() === '') {
    throw new Error('Doctor ID is required');
  }
  if (isDjangoApiEnabled()) {
    const result = await djangoCreateSharingRequest({
      clinicianId: doctorId,
      patientId,
      message: reason,
    });
    return String(result.id);
  }
  return `sharing-request-${Date.now()}`;
};

export const createTestSharingRequests = async (_doctorId: string): Promise<void> => {
  // TODO: replace with a Django test-data helper once available.
};


export interface DoctorPatientGrowth {
  /** Patients linked to this doctor during the current calendar month. */
  addedThisMonth: number;
  /** Patients linked during the previous calendar month. */
  addedLastMonth: number;
  /**
   * Month-over-month change, or `null` when it cannot be derived, either the
   * roster has no dated links or last month had none to compare against.
   */
  changePct: number | null;
  /** Roster entries with no `approvedAt`, so they cannot be dated. */
  undatedLinks: number;
}

/**
 * Real patient growth, derived from when each patient was linked to the doctor.
 * Returns `changePct: null` rather than inventing a number when there is no
 * comparable history.
 */
export const getDoctorPatientGrowth = async (
  _doctorId: string,
): Promise<DoctorPatientGrowth> => {
  if (!isDjangoApiEnabled()) {
    return { addedThisMonth: 0, addedLastMonth: 0, changePct: null, undatedLinks: 0 };
  }

  try {
    const panel = await djangoListPatientPanel();
    // Panel API does not yet expose link dates; growth stats need a dated roster endpoint.
    return {
      addedThisMonth: 0,
      addedLastMonth: 0,
      changePct: null,
      undatedLinks: panel.length,
    };
  } catch {
    return { addedThisMonth: 0, addedLastMonth: 0, changePct: null, undatedLinks: 0 };
  }
};

export const listenToDoctorPatients = (
  doctorId: string,
  onPatientsUpdate: (patients: Patient[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }

  if (isDjangoApiEnabled()) {
    let cancelled = false;
    const poll = async () => {
      try {
        const patients = await getDoctorPatients(doctorId);
        if (!cancelled) onPatientsUpdate(patients);
      } catch (error) {
        if (!cancelled) {
          onError(error instanceof Error ? error : new Error('Failed to load patients'));
        }
      }
    };
    void poll();
    const timer = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }

  onPatientsUpdate([]);
  return () => {};
};

export const listenToDoctorSharingRequests = (
  doctorId: string,
  onRequestsUpdate: (requests: SharingRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }

  if (isDjangoApiEnabled()) {
    let cancelled = false;
    const poll = async () => {
      try {
        const requests = await getDoctorSharingRequests(doctorId);
        if (!cancelled) onRequestsUpdate(requests);
      } catch (error) {
        if (!cancelled) {
          onError(error instanceof Error ? error : new Error('Failed to load sharing requests'));
        }
      }
    };
    void poll();
    const timer = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }

  onRequestsUpdate([]);
  return () => {};
};

export const listenToDoctorPatientRequests = (
  doctorId: string,
  onRequestsUpdate: (requests: PatientRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }

  onRequestsUpdate([]);
  return () => {};
};
