import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PatientWearableSummary {
  steps: number | null;
  averageHeartRate: number | null;
  sleepHours: number | null;
  lastSyncAt: Date | null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: number }).seconds === 'number'
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getPatientWearableSummary(
  patientId: string,
): Promise<PatientWearableSummary | null> {
  const ref = doc(db, 'Users', patientId, 'heathSummary', 'latest');
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const avgHR =
    typeof data.heartRateCount === 'number' &&
    data.heartRateCount > 0 &&
    typeof data.heartRateSum === 'number'
      ? Math.round(data.heartRateSum / data.heartRateCount)
      : (data.averageHeartRate ?? null);

  return {
    steps: typeof data.steps === 'number' ? data.steps : null,
    averageHeartRate: typeof avgHR === 'number' ? avgHR : null,
    sleepHours: typeof data.sleepHours === 'number' ? data.sleepHours : null,
    lastSyncAt: toDate(data.lastSyncAt),
  };
}
