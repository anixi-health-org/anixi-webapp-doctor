import { parseConsultScribeNote, type ConsultScribeNote } from '../lib/consultScribeNote';
import { djangoScribeTranscribe, isDjangoApiEnabled } from './djangoApiService';
import { streamAskAnixi, type AskAnixiContext } from './askAnixiService';

export const AYAH_SCRIBE_ACTION_ID = 'ayah_scribe';
export const AYAH_SCRIBE_TITLE = 'Ayah consult note';

export type { ConsultScribeNote };

export async function transcribeConsultChunk(
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  // Django path owns scribe transcription once REACT_APP_ANIXI_API_URL is set.
  if (isDjangoApiEnabled()) {
    return djangoScribeTranscribe(audioBase64, mimeType);
  }
  // Firebase Functions path removed.
  throw new Error(
    'Consult scribe transcription is not available. Set REACT_APP_ANIXI_API_URL to enable the Django scribe endpoint, or start Mastra locally.',
  );
}

export async function structureConsultTranscript(params: {
  transcript: string;
  patientName: string;
  doctorName?: string;
  appointmentId: string;
  /** Anything the doctor typed in the call notes panel; Ayah folds it into the note. */
  doctorNotes?: string;
  context?: AskAnixiContext;
}): Promise<ConsultScribeNote> {
  const trimmed = params.transcript.trim();
  if (!trimmed) return parseConsultScribeNote('');

  const doctorNotes = params.doctorNotes?.trim();
  let assembled = '';
  // The consult-scribe agent carries the note format; it has no tools and keeps no memory.
  await streamAskAnixi({
    agentId: 'consult-scribe',
    message: [
      `Patient: ${params.patientName}`,
      params.doctorName ? `Doctor: ${params.doctorName}` : null,
      doctorNotes ? `Doctor's own notes typed during the call:\n${doctorNotes}` : null,
      `Call transcript:\n${trimmed}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    context: {
      ...params.context,
      appointmentId: params.appointmentId,
      patientName: params.patientName,
    },
    threadId: `${params.context?.patientId ?? 'scribe'}:${params.appointmentId}:scribe`,
    onChunk: (chunk) => {
      assembled += chunk;
    },
  });

  return parseConsultScribeNote(assembled.trim());
}

export function formatSoapNoteFromPayload(payload: Record<string, unknown>): string {
  const parts = [
    payload.subjective ? `Subjective: ${String(payload.subjective)}` : null,
    payload.objective ? `Objective: ${String(payload.objective)}` : null,
    payload.assessment ? `Assessment: ${String(payload.assessment)}` : null,
    payload.plan ? `Plan: ${String(payload.plan)}` : null,
  ].filter(Boolean);
  return parts.join('\n\n');
}
