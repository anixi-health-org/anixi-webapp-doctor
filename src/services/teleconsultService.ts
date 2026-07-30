import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../lib/firebase';

const functions = getFunctions(app, 'europe-west1');

export interface TeleconsultTokenResult {
  serverUrl: string;
  token: string;
  roomName: string;
}

export async function fetchTeleconsultToken(
  doctorId: string,
  appointmentId: string
): Promise<TeleconsultTokenResult> {
  const callable = httpsCallable<
    { doctorId: string; appointmentId: string },
    TeleconsultTokenResult
  >(functions, 'getTeleconsultToken');

  const result = await callable({ doctorId, appointmentId });
  return result.data;
}

export async function endTeleconsultSession(
  doctorId: string,
  appointmentId: string
): Promise<void> {
  const callable = httpsCallable<{ doctorId: string; appointmentId: string }, { ok: boolean }>(
    functions,
    'endTeleconsult'
  );
  await callable({ doctorId, appointmentId });
}

export function teleconsultErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const code = 'code' in err ? String((err as { code?: string }).code) : '';
    const message = String((err as { message: string }).message);
    const cleaned = message.replace(/^Firebase:\s*/i, '').replace(/\s*\([^)]+\)\.?$/, '').trim();

    if (code.includes('failed-precondition') || cleaned.includes('LiveKit is not configured')) {
      return cleaned || message;
    }
    if (code.includes('internal') || cleaned.toLowerCase() === 'internal') {
      return 'Could not start the video room. Please try again in a moment.';
    }
    if (cleaned) return cleaned;
  }
  return 'Unable to start teleconsult. Please try again.';
}
