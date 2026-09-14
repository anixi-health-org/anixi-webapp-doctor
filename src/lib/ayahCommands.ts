import type { AskAnixiContext } from '../services/askAnixiService';

export type AyahCommand = {
  id: string;
  label: string;
  shortLabel?: string;
  prompt: string;
  hint: string;
  needsPatient?: boolean;
};

export const PRACTICE_COMMANDS: AyahCommand[] = [
  {
    id: 'today',
    label: 'What do I need to know today?',
    shortLabel: "Today's briefing",
    hint: 'Practice briefing',
    prompt:
      'What do I need to know today? Use the work queue and today’s panel. Lead with attention, then appointments, then the next useful action. Plain text only.',
  },
  {
    id: 'prepare-next',
    label: 'Prepare next patient',
    shortLabel: 'Prepare next',
    hint: 'Pre-visit brief',
    prompt:
      'Prepare me for my next patient. Use prepare-next-patient. Give a pre-visit brief with sources. If nobody is scheduled, say so.',
  },
  {
    id: 'attention',
    label: 'What needs my attention?',
    shortLabel: 'Needs attention',
    hint: 'Work queue',
    prompt:
      'What needs my attention? Use list-practice-panel and the work queue. Name every patient. Do not invent urgency.',
  },
  {
    id: 'panel',
    label: 'Who is on my panel?',
    shortLabel: 'My panel',
    hint: 'Full practice list',
    prompt:
      'List every patient on my practice panel with name, account activation status, and recorded conditions only. Use list-practice-panel. Do not invent clinical status.',
  },
  {
    id: 'inbox',
    label: 'Triage my inbox',
    shortLabel: 'Inbox',
    hint: 'Messages',
    prompt:
      'Triage my inbox. Rank messages and draft replies I can approve. Never send anything.',
  },
  {
    id: 'follow-ups-practice',
    label: 'Open follow-ups',
    shortLabel: 'Follow-ups',
    hint: 'Across the panel',
    prompt:
      'What follow-ups are open on my panel? Use list-practice-panel and the work queue. Name patients. Do not invent overdue clinical need.',
  },
  {
    id: 'practice-setup',
    label: 'What is left to set up?',
    shortLabel: 'Practice setup',
    hint: 'Team, hours, roster',
    prompt:
      'What is left to set up in this practice? Use get-practice-workspace. Then team, hours, roster, and listing. Name real gaps only.',
  },
  {
    id: 'team',
    label: 'Who is on my team?',
    shortLabel: 'Team',
    hint: 'Members and roles',
    prompt:
      'Who is on my clinic team? Use list-team-members. Include role and status. Do not invent people.',
  },
  {
    id: 'hours',
    label: 'When are we open?',
    shortLabel: 'Hours',
    hint: 'Clinic hours',
    prompt:
      'When is this practice open? Use get-practice-hours. List weekdays and doctors. If none, say hours are not set.',
  },
  {
    id: 'invoices',
    label: 'Show recent invoices',
    shortLabel: 'Invoices',
    hint: 'Billing',
    prompt:
      'List recent invoices for this practice. Use list-invoices. Do not invent amounts. If I cannot view billing, say so.',
  },
];

export const PATIENT_COMMANDS: AyahCommand[] = [
  {
    id: 'thirty-sec',
    label: '30-second brief',
    shortLabel: '30-second brief',
    hint: 'Who, why, what matters',
    prompt:
      'Give me this patient in 30 seconds. Use the patient overview. Sections: Who, Why today, Key history, Recent change, Important results, Current treatment, Open issue, Suggested focus.',
    needsPatient: true,
  },
  {
    id: 'what-changed',
    label: 'What changed?',
    shortLabel: 'What changed',
    hint: 'Since last visit',
    prompt:
      'What changed since the last visit? Use compare-visits. Sections: New, Unresolved, Unchanged. Do not invent causation.',
    needsPatient: true,
  },
  {
    id: 'overview',
    label: 'Patient overview',
    shortLabel: 'Overview',
    hint: 'Full context',
    prompt:
      'Give me a concise patient overview from the record. Include sources. Do not invent findings.',
    needsPatient: true,
  },
  {
    id: 'medications',
    label: 'Medications',
    shortLabel: 'Medications',
    hint: 'Current list',
    prompt: 'Summarize the current medications and any adherence signal. Do not change the record.',
    needsPatient: true,
  },
  {
    id: 'results',
    label: 'Recent results',
    shortLabel: 'Review results',
    hint: 'Documents and labs',
    prompt:
      'Show the latest relevant results and documents. Never invent values. Name the source of each item.',
    needsPatient: true,
  },
  {
    id: 'story',
    label: 'Patient story',
    hint: 'Timeline',
    prompt:
      'Give me the patient’s story from the timeline. Chronological, source-grounded, no unsupported conclusions.',
    needsPatient: true,
  },
  {
    id: 'draft-note',
    label: 'Draft today’s note',
    hint: 'Needs your review',
    prompt:
      'Draft today’s clinical note from the available record only. Do not invent examination findings, statements, diagnoses, or treatment decisions. Label it as an AI-generated draft.',
    needsPatient: true,
  },
  {
    id: 'draft-message',
    label: 'Draft a message',
    hint: 'Patient-facing',
    prompt:
      'Draft a patient-friendly message for my review. Preserve clinical meaning. Do not send it.',
    needsPatient: true,
  },
  {
    id: 'meds-review',
    label: 'Review medications',
    hint: 'Reconciliation',
    prompt:
      'Review medications for this patient. Use reconcile-medications. Sections: Current record, Patient reports, Possible discrepancy. Do not change the record.',
    needsPatient: true,
  },
  {
    id: 'result-review',
    label: 'Review results',
    hint: 'Needs your assessment',
    prompt:
      'Review the latest results. Use review-result. Never invent values or say the result is safe or unsafe. Clinician assessment required.',
    needsPatient: true,
  },
  {
    id: 'trends',
    label: 'Trends',
    hint: 'Vitals and symptoms',
    prompt:
      'Show recorded trends. Use get-longitudinal-trends. Dates, values, and sources only. Do not invent causation.',
    needsPatient: true,
  },
  {
    id: 'follow-ups',
    label: 'Follow-ups',
    hint: 'Open care items',
    prompt:
      'What follow-ups are open for this patient? Use get-follow-up-intelligence. Cite sources. Do not invent overdue need.',
    needsPatient: true,
  },
  {
    id: 'questions',
    label: 'What should I ask?',
    hint: 'Before or during the visit',
    prompt:
      'What should I clarify with this patient? Use get-questions-to-clarify. This is support, not a mandated checklist.',
    needsPatient: true,
  },
  {
    id: 'handoff',
    label: 'Draft a handoff',
    hint: 'Needs your review',
    prompt:
      'Draft a clinician handoff from the record. Use draft-handoff. Label it as an AI-generated draft. Do not send it.',
    needsPatient: true,
  },
  {
    id: 'referral',
    label: 'Draft a referral',
    hint: 'Needs your review',
    prompt:
      'Draft a referral from the record. Use draft-referral. Label it as an AI-generated draft. Do not send it.',
    needsPatient: true,
  },
  {
    id: 'care-plan',
    label: 'Draft a care plan',
    hint: 'Needs your review',
    prompt:
      'Draft a care plan from the record only. Use draft-care-plan. Do not invent goals or follow-up intervals. Label it as an AI-generated draft.',
    needsPatient: true,
  },
  {
    id: 'instructions',
    label: 'Patient instructions',
    hint: 'Patient-friendly draft',
    prompt:
      'Draft patient-friendly instructions from the current plan. Use draft-patient-instructions. Preserve clinical meaning. Do not send.',
    needsPatient: true,
  },
];

export function commandNeedsPatient(command: AyahCommand, context: AskAnixiContext) {
  return Boolean(command.needsPatient && !context.patientId);
}
