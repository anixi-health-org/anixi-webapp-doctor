import {
  djangoAssignPracticePatient,
  djangoBulkAssignPracticePatients,
  djangoGetPracticePatientAccount,
  djangoListPracticePatients,
  djangoPatchPracticePatientAccount,
  type DjangoPracticePatient,
} from './djangoApiService';
import type { Patient } from '../types';

export type PracticePatientQuery = {
  q?: string;
  page?: number;
  limit?: number;
};

export type PracticePatientPage = {
  patients: Patient[];
  total: number;
  page: number;
  limit: number;
};

function mapPracticePatient(row: {
  patientId: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  practiceId?: string | null;
  assignedDoctorId?: string | null;
  status?: string;
  activationCode?: string | null;
}, practiceId: string): Patient {
  return {
    id: row.patientId,
    email: row.email,
    displayName: (row.displayName || '').trim(),
    phoneNumber: row.phoneNumber || undefined,
    role: 'patient' as const,
    practiceId: row.practiceId ?? practiceId,
    assignedDoctorId: row.assignedDoctorId ?? undefined,
    rosterStatus: row.status,
    activationCode: row.activationCode ?? undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Practice-level patient pool. Always paginated; never load the full clinic roster.
 */
export const listPracticePatientsPage = async (
  practiceId: string,
  query: PracticePatientQuery = {},
): Promise<PracticePatientPage> => {
  const result = await djangoListPracticePatients(practiceId, query);
  return {
    patients: result.rows.map((row) => mapPracticePatient(row, practiceId)),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
};

export const listPracticePatients = async (
  practiceId: string,
  query: PracticePatientQuery = {},
): Promise<Patient[]> => {
  const page = await listPracticePatientsPage(practiceId, query);
  return page.patients;
};

export const updatePracticePatientAssignedDoctor = async (
  practiceId: string,
  patientId: string,
  assignedDoctorId: string | null,
): Promise<void> => {
  await djangoAssignPracticePatient(practiceId, patientId, assignedDoctorId);
};

export const bulkAssignPracticePatients = async (
  practiceId: string,
  payload: {
    assignedDoctorId: string | null;
    patientIds?: string[];
    allMatching?: boolean;
    q?: string;
  },
) => djangoBulkAssignPracticePatients(practiceId, payload);

export const getPracticePatientAccount = async (
  practiceId: string,
  patientId: string,
): Promise<DjangoPracticePatient> => djangoGetPracticePatientAccount(practiceId, patientId);

export const updatePracticePatientAccount = async (
  practiceId: string,
  patientId: string,
  patch: Record<string, unknown>,
): Promise<DjangoPracticePatient> => djangoPatchPracticePatientAccount(practiceId, patientId, patch);
