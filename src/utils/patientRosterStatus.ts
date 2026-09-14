import type { Patient } from '../types';
import { isPlaceholderPatientEmail } from './patientContact';

/** Account activation only. Never a clinical assessment. */
export type PatientAccountStatus = 'pending' | 'active' | 'unknown';

export function patientAccountStatus(
  patient: Pick<Patient, 'email' | 'rosterStatus'>,
): PatientAccountStatus {
  if (patient.rosterStatus === 'active') return 'active';
  if (patient.rosterStatus === 'pending') return 'pending';
  if (isPlaceholderPatientEmail(patient.email)) return 'pending';
  return 'unknown';
}

export function patientAccountStatusLabel(status: PatientAccountStatus): string {
  if (status === 'active') return 'Activated';
  if (status === 'pending') return 'Pending activation';
  return 'Not recorded';
}
