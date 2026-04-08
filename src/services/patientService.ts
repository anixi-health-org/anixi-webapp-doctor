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
    const patientDocRef = doc(db, USERS_COLLECTION, patientId);
    const patientDoc = await getDoc(patientDocRef);

    if (!patientDoc.exists()) {
      console.warn(`[fetchPatientInfo] Patient not found: ${patientId}`);
      return null;
    }

    const data = patientDoc.data();
    return {
      id: patientDoc.id,
      displayName: data.displayName || data.name || 'Unknown Patient',
      email: data.email,
      role: data.role,
    };
  } catch (error) {
    console.error(`[fetchPatientInfo] Error fetching patient ${patientId}:`, error);
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
  
  // Remove duplicates
  const uniqueIds = Array.from(new Set(patientIds));
  
  for (const patientId of uniqueIds) {
    const patient = await fetchPatientInfo(patientId);
    if (patient) {
      patientMap.set(patientId, patient);
    }
  }

  return patientMap;
};
