import { djangoGetPatientChart, djangoListPatientPanel } from './djangoApiService';

export interface PatientInfo {
  id: string;
  displayName?: string;
  email?: string;
  role?: string;
}

export const fetchPatientInfo = async (patientId: string): Promise<PatientInfo | null> => {
  if (!patientId) return null;
  try {
    const chart = await djangoGetPatientChart(patientId);
    if (chart) {
      return {
        id: patientId,
        displayName: String(chart.displayName ?? chart.name ?? ''),
        email: chart.email ? String(chart.email) : undefined,
        role: 'patient',
      };
    }

    const panel = await djangoListPatientPanel();
    const row = panel.find((p) => p.patientId === patientId);
    if (!row) return null;

    return {
      id: patientId,
      displayName: row.displayName || '',
      email: row.email,
      role: 'patient',
    };
  } catch {
    return null;
  }
};

export const getPatientDisplayName = async (patientId: string): Promise<string> => {
  const patient = await fetchPatientInfo(patientId);
  return patient?.displayName || 'Unnamed patient';
};

export const fetchMultiplePatients = async (
  patientIds: string[],
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
