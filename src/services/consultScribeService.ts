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
  appointmentId: string;
  context?: AskAnixiContext;
}): Promise<ConsultScribeNote> {
  const trimmed = params.transcript.trim();
  if (!trimmed) {
    return {
      summary: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      followUps: [],
      fullText: '',
    };
  }

  let assembled = '';
  await streamAskAnixi({
    message: `You are Ayah, clinical scribe for a South African doctor. The transcript below is from a live teleconsult (doctor and patient audio from the video call).

Produce a chart-ready post-visit note for ${params.patientName}.

Use EXACTLY this plain-text structure (no markdown, no em dashes):

SUMMARY:
Two to four sentences capturing why the patient came, what was discussed, and the outcome.

SUBJECTIVE:
Patient-reported symptoms, history, and concerns from the visit.

OBJECTIVE:
Observable or stated clinical findings documented in the conversation. If none were discussed, write "Not documented in visit audio."

ASSESSMENT:
Clinical impression based only on what was said. Do not invent diagnoses.

PLAN:
Agreed next steps, prescriptions, referrals, tests, or advice mentioned.

FOLLOW_UPS:
- Bullet list of follow-up actions for the doctor

Rules:
- Only use information from the transcript.
- Do not invent vitals, examination findings, or medications.
- Keep language concise and professional.

Transcript:
${trimmed}`,
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
