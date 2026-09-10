import {
  djangoEndTeleconsult,
  djangoFetchTeleconsultToken,
} from './djangoApiService';

export interface TeleconsultTokenResult {
  serverUrl: string;
  token: string;
  roomName: string;
}

export async function fetchTeleconsultToken(
  _doctorId: string,
  appointmentId: string,
): Promise<TeleconsultTokenResult> {
  return djangoFetchTeleconsultToken(appointmentId);
}

export async function endTeleconsultSession(
  _doctorId: string,
  appointmentId: string,
): Promise<void> {
  await djangoEndTeleconsult(appointmentId);
}

export function teleconsultErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message: string }).message);
    const cleaned = message.replace(/^Firebase:\s*/i, '').replace(/\s*\([^)]+\)\.?$/, '').trim();

    if (cleaned.includes('LiveKit is not configured')) {
      return cleaned || message;
    }
    if (cleaned.toLowerCase() === 'internal') {
      return 'Could not start the video room. Please try again in a moment.';
    }
    if (cleaned) return cleaned;
  }
  return 'Unable to start teleconsult. Please try again.';
}
