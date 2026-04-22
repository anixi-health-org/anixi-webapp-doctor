import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
export interface PatientInfo {
  id: string;
  displayName?: string;
  email?: string;
  role?: string;
}
export const fetchPatientInfo = async (patientId: string): Promise<PatientInfo | null> => {
  if (!patientId) return null;
  try {
    const patientDocRef = doc(db, 'patients', patientId);
    const patientDoc = await getDoc(patientDocRef);
    if (!patientDoc.exists()) {
      ;
      return null;
    }
    const data = patientDoc.data();
    return {
      id: patientDoc.id,
      displayName: data.displayName || data.name || 'Patient',
      email: data.email,
      role: data.role,
    };
  } catch (error) {
    ;
    return null;
  }
};
export const getPatientDisplayName = async (patientId: string): Promise<string> => {
  const patient = await fetchPatientInfo(patientId);
  return patient?.displayName || `Patient ${patientId.substring(0, 8)}`;
};
export const fetchMultiplePatients = async (
  patientIds: string[]
): Promise<Map<string, PatientInfo>> => {
  const patientMap = new Map<string, PatientInfo>();
  const uniqueIds = Array.from(new Set(patientIds));
  for (const patientId of uniqueIds) {
    const patient = await fetchPatientInfo(patientId);
    if (patient) {
      patientMap.set(patientId, patient);
    }
  }
  return patientMap;
};
