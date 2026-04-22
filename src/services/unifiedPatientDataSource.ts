import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Patient } from '../types';
const DEBUG_NAMESPACE = '🔗[UnifiedPatientDataSource]';
const DEBUG_ENABLED = true;
const log = (message: string, data?: any) => {
  if (DEBUG_ENABLED) {
    if (data === undefined) {
    } else {
    }
  }
};
const logError = (message: string, error?: any) => {
  ;
};
export const getPatientsByDoctorId = async (
  doctorId: string | undefined
): Promise<Patient[]> => {
  log('📡 Starting patient fetch', { doctorId });
  if (!validateDoctorId(doctorId)) {
    logError('❌ Invalid doctor ID', { doctorId });
    return [];
  }
  try {
    const constraints: QueryConstraint[] = [
      where('doctorId', '==', doctorId),
      where('role', '==', 'patient'),
    ];
    log('🔍 Building query', { constraints: constraints.length });
    const usersRef = collection(db, 'Users');
    const q = query(usersRef, ...constraints);
    log('⏳ Executing query...');
    const snapshot = await getDocs(q);
    log('📦 Query completed', { documentCount: snapshot.docs.length });
    const patients = snapshot.docs.map((doc) => {
      const data = doc.data();
      log(`  ✅ Patient: ${data.displayName || 'Unknown'} (${doc.id})`);
      return {
        id: doc.id,
        email: data.email ?? '',
        displayName: data.displayName ?? 'Unknown',
        role: data.role ?? 'patient',
        dateOfBirth: data.dateOfBirth ?? null,
        gender: data.gender ?? '',
        maritalStatus: data.maritalStatus ?? '',
        language: data.language ?? 'en',
        address: data.address ?? '',
        phoneNumber: data.phoneNumber ?? '',
        assignedDoctorId: data.doctorId ?? data.assignedDoctorId ?? '',
        emergencyContact: data.emergencyContact ?? '',
        medicalAid: data.medicalAid ?? '',
        chronicDiseases: data.chronicDiseases ?? [],
        allergies: data.allergies ?? [],
        currentTreatments: data.currentTreatments ?? [],
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
      } as Patient;
    });
    log(`✨ Successfully loaded ${patients.length} patients`, {
      doctorId,
      patientCount: patients.length,
    });
    return patients;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError('❌ Failed to fetch patients', {
      message: err.message,
      doctorId,
    });
    throw err;
  }
};
export const getPatientById = async (patientId: string): Promise<Patient | null> => {
  log(`📄 Fetching patient by ID: ${patientId}`);
  try {
    const docRef = doc(db, 'Users', patientId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      log(`⚠️  Patient not found: ${patientId}`);
      return null;
    }
    const data = docSnap.data();
    const patient: Patient = {
      id: docSnap.id,
      email: data.email ?? '',
      displayName: data.displayName ?? 'Unknown',
      role: data.role ?? 'patient',
      dateOfBirth: data.dateOfBirth ?? null,
      gender: data.gender ?? '',
      maritalStatus: data.maritalStatus ?? '',
      language: data.language ?? 'en',
      address: data.address ?? '',
      phoneNumber: data.phoneNumber ?? '',
      assignedDoctorId: data.doctorId ?? data.assignedDoctorId ?? '',
      emergencyContact: data.emergencyContact ?? '',
      medicalAid: data.medicalAid ?? '',
      chronicDiseases: data.chronicDiseases ?? [],
      allergies: data.allergies ?? [],
      currentTreatments: data.currentTreatments ?? [],
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    };
    log(`✅ Patient loaded: ${patient.displayName}`);
    return patient;
  } catch (error) {
    logError(`❌ Failed to fetch patient by ID: ${patientId}`, error);
    return null;
  }
};
export const validateDoctorId = (doctorId: string | undefined): boolean => {
  if (!doctorId) {
    log('⚠️  Doctor ID is empty or undefined');
    return false;
  }
  if (typeof doctorId !== 'string') {
    log('⚠️  Doctor ID is not a string', { type: typeof doctorId });
    return false;
  }
  if (doctorId.trim().length === 0) {
    log('⚠️  Doctor ID is whitespace only');
    return false;
  }
  log('✅ Doctor ID is valid', { doctorId });
  return true;
};
export const isValidPatient = (patient: any): patient is Patient => {
  return (
    patient &&
    typeof patient === 'object' &&
    typeof patient.id === 'string' &&
    typeof patient.displayName === 'string' &&
    patient.assignedDoctorId !== undefined
  );
};
export const filterValidPatients = (patients: any[]): Patient[] => {
  const valid = patients.filter((p) => isValidPatient(p));
  if (valid.length < patients.length) {
    const filtered = patients.length - valid.length;
    log(`⚠️  Filtered out ${filtered} invalid patient records`);
  }
  return valid;
};
export const getPatientCountByDoctor = async (
  doctorId: string | undefined
): Promise<number> => {
  const patients = await getPatientsByDoctorId(doctorId);
  return patients.length;
};
export const getDiagnosticInfo = async (
  doctorId: string | undefined
): Promise<{
  doctorId: string | undefined;
  isValidDoctorId: boolean;
  patientCount: number;
  patients: Array<{ id: string; displayName: string | undefined; email: string }>;
}> => {
  log('🔧 Running diagnostic check');
  const isValid = validateDoctorId(doctorId);
  let patients: Patient[] = [];
  if (isValid) {
    try {
      patients = await getPatientsByDoctorId(doctorId);
    } catch (error) {
      logError('🔧 Diagnostic: Failed to fetch patients', error);
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
