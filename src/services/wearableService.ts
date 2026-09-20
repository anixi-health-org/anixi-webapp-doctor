import { djangoGetPatientChart, isDjangoApiEnabled } from './djangoApiService';

export interface PatientWearableSummary {
  steps: number | null;
  averageHeartRate: number | null;
  sleepHours: number | null;
  lastSyncAt: Date | null;
}

export async function getPatientWearableSummary(
  patientId: string,
): Promise<PatientWearableSummary | null> {
  if (!isDjangoApiEnabled()) return null;
  const chart = await djangoGetPatientChart(patientId).catch(() => null);
  const summary = chart?.wearableSummary as Record<string, unknown> | undefined;
  if (!summary) return null;

  return {
    steps: typeof summary.steps === 'number' ? summary.steps : null,
    averageHeartRate:
      typeof summary.averageHeartRate === 'number' ? summary.averageHeartRate : null,
    sleepHours: typeof summary.sleepHours === 'number' ? summary.sleepHours : null,
    lastSyncAt: summary.lastSyncAt ? new Date(String(summary.lastSyncAt)) : null,
  };
}
