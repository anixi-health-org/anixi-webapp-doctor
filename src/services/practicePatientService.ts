import { djangoAssignPracticePatient, djangoListPracticePatients } from './djangoApiService';
import type { Patient } from '../types';

/**
 * Practice-level patient pool — all patients whose home practice is this clinic/practice.
 */
export const listPracticePatients = async (practiceId: string): Promise<Patient[]> => {
  const rows = await djangoListPracticePatients(practiceId);
  return rows.map((row) => ({
    id: row.patientId,
    email: row.email,
    displayName: row.displayName || 'Patient',
    phoneNumber: row.phoneNumber || undefined,
    role: 'patient' as const,
    practiceId: row.practiceId ?? practiceId,
    assignedDoctorId: row.assignedDoctorId ?? undefined,
    rosterStatus: row.status,
    activationCode: row.activationCode ?? undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
};

export const updatePracticePatientAssignedDoctor = async (
  practiceId: string,
  patientId: string,
  assignedDoctorId: string | null,
): Promise<void> => {
  await djangoAssignPracticePatient(practiceId, patientId, assignedDoctorId);
};
