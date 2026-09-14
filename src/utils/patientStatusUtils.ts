import { Patient } from '../types';
import { patientAccountStatusLabel, patientAccountStatus } from './patientRosterStatus';

export const isPatientInactive = async (patient: Patient): Promise<boolean> => {
  return patientAccountStatus(patient) === 'pending';
};

export const getPatientStatus = async (patient: Patient): Promise<string> => {
  return patientAccountStatusLabel(patientAccountStatus(patient));
};
