import { Patient } from '../types';
import { getDoctorPatients } from './patientManagementService';

export const getPatientsByDoctorId = async (
  doctorId: string | undefined,
): Promise<Patient[]> => {
  if (!doctorId || typeof doctorId !== 'string' || doctorId.trim().length === 0) {
    return [];
  }
  return getDoctorPatients(doctorId);
};

export const getPatientById = async (patientId: string): Promise<Patient | null> => {
  const { fetchPatientInfo } = await import('./patientService');
  const info = await fetchPatientInfo(patientId);
  if (!info) return null;
  return {
    id: info.id,
    email: info.email ?? '',
    displayName: info.displayName ?? 'Unknown',
    role: 'patient',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export const validateDoctorId = (doctorId: string | undefined): boolean =>
  Boolean(doctorId && typeof doctorId === 'string' && doctorId.trim().length > 0);

export const isValidPatient = (patient: unknown): patient is Patient =>
  Boolean(
    patient &&
      typeof patient === 'object' &&
      typeof (patient as Patient).id === 'string' &&
      typeof (patient as Patient).displayName === 'string',
  );

export const filterValidPatients = (patients: unknown[]): Patient[] =>
  patients.filter(isValidPatient);

export const getPatientCountByDoctor = async (doctorId: string | undefined): Promise<number> =>
  (await getPatientsByDoctorId(doctorId)).length;

export const getDiagnosticInfo = async (doctorId: string | undefined) => {
  const isValid = validateDoctorId(doctorId);
  let patients: Patient[] = [];
  if (isValid) {
    try {
      patients = await getPatientsByDoctorId(doctorId);
    } catch {
      patients = [];
    }
  }
  return {
    doctorId,
    isValidDoctorId: isValid,
    patientCount: patients.length,
    patients: patients.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      email: p.email,
    })),
  };
};
