import { Patient } from '../types';
import { getAdherenceStats } from '../services/adherenceService';


export const isPatientInactive = async (patient: Patient): Promise<boolean> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const today = new Date();
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];

    const stats = await getAdherenceStats(patient.id, fromDate, toDate);
    return stats.averageAdherence < 5;
  } catch (err) {
    ;
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const lastUpdate = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
    return lastUpdate < fiveDaysAgo;
  }
};



export const getPatientStatus = async (patient: Patient): Promise<string> => {
  if (patient.chronicDiseases && patient.chronicDiseases.length > 0) {
    return 'Action Required';
  }

  const inactive = await isPatientInactive(patient);
  if (inactive) {
    return 'Inactive';
  }

  return 'Stable';
};