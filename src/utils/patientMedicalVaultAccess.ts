import type { Patient } from '../types';
import type { SharedRecordGrant } from '../services/medicalRecordShareService';
import type { DjangoPanelPatient } from '../services/djangoApiService';

/** Patient has an activated app account on the doctor's panel. */
export function patientIsOnDoctorPanel(
  patientId: string,
  panel: DjangoPanelPatient[],
): boolean {
  const row = panel.find((entry) => entry.patientId === patientId);
  return row?.status === 'active';
}

/** Patient approved sharing medical records with this doctor. */
export function patientSharedRecordsWithDoctor(
  patientId: string,
  shares: SharedRecordGrant[],
): boolean {
  return shares.some((grant) => grant.patientId === patientId);
}

/**
 * Show the medical record vault when the patient is connected to the doctor:
 * activated on the panel, or an approved record share exists.
 */
export function canDoctorViewPatientMedicalVault(
  patient: Pick<Patient, 'id' | 'rosterStatus'> | null | undefined,
  options?: {
    sharedPatientIds?: Set<string>;
  },
): boolean {
  if (!patient?.id) return false;
  if (patient.rosterStatus === 'active') return true;
  if (options?.sharedPatientIds?.has(patient.id)) return true;
  return false;
}
