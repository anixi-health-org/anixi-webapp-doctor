import type { CopilotIcd10Suggestion, PreVisitSummary } from '../types';
import { djangoCompanionStream } from './djangoApiService';

async function companionJsonPrompt<T>(message: string, context?: Record<string, unknown>): Promise<T> {
  let buffer = '';
  await djangoCompanionStream({
    message,
    context: { ...context, responseFormat: 'json' },
    onChunk: (chunk) => {
      buffer += chunk;
    },
  });
  try {
    return JSON.parse(buffer) as T;
  } catch {
    throw new Error('Copilot returned an invalid response. Please try again.');
  }
}

export async function suggestBillingCodes(
  query: string,
  noteSnippet?: string,
): Promise<{ icd10: CopilotIcd10Suggestion[] }> {
  return companionJsonPrompt('suggest_billing_codes', { query, noteSnippet });
}

export async function fetchPreVisitSummary(
  patientId: string,
  appointmentId?: string,
): Promise<PreVisitSummary> {
  return companionJsonPrompt('pre_visit_summary', { patientId, appointmentId });
}

export async function draftMessageReply(
  patientMessage: string,
  patientName?: string,
): Promise<{ draft: string }> {
  return companionJsonPrompt('draft_message_reply', { patientMessage, patientName });
}
