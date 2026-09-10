import { djangoAutoMatchRoster } from './djangoApiService';

/**
 * Sync doctor patient roster via Django auto-match (appointments + record shares).
 */
export const syncDoctorPatientRoster = async (doctorId: string): Promise<number> => {
  void doctorId;
  try {
    const result = await djangoAutoMatchRoster();
    return result.matched ? 1 : 0;
  } catch (error) {
    console.warn('[patientRosterSync] auto-match failed:', error);
    return 0;
  }
};
