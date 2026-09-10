export interface PatientWearableSummary {
  steps: number | null;
  averageHeartRate: number | null;
  sleepHours: number | null;
  lastSyncAt: Date | null;
}

export async function getPatientWearableSummary(
  patientId: string,
): Promise<PatientWearableSummary | null> {
  // TODO: replace with a Django wearable summary endpoint once available.
  return null;
}
