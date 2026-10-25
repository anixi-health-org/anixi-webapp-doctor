export type ConsultScribeNote = {
  summary: string;
  /** Every distinct thing discussed, in order, so nothing said in the visit is lost. */
  keyPoints: string[];
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  /** Medicines the doctor named in the call; gaps are marked [confirm ...]. Empty when none. */
  prescriptionDraft: string;
  /** Referral letter body when a referral was discussed. Empty when none. */
  referralDraft: string;
  patientInstructions: string;
  followUps: string[];
  redFlags: string[];
  fullText: string;
};

const SECTION_HEADERS = [
  'SUMMARY',
  'KEY_POINTS',
  'SUBJECTIVE',
  'OBJECTIVE',
  'ASSESSMENT',
  'PLAN',
  'PRESCRIPTION_DRAFT',
  'REFERRAL_DRAFT',
  'PATIENT_INSTRUCTIONS',
  'FOLLOW_UPS',
  'FOLLOW-UPS',
  'RED_FLAGS',
] as const;

/** Placeholder answers the scribe gives for an empty section. */
const NOTHING = /^(none (discussed|noted)\.?|not discussed\.?|n\/a)$/i;

function sectionBody(text: string, header: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${header}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${SECTION_HEADERS.join('|')})\\s*:|$)`,
    'i',
  );
  const body = text.match(pattern)?.[1]?.trim() ?? '';
  return NOTHING.test(body) ? '' : body;
}

function parseList(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line && !NOTHING.test(line));
}

function emptyNote(fullText = ''): ConsultScribeNote {
  return {
    summary: fullText.slice(0, 280),
    keyPoints: [],
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    prescriptionDraft: '',
    referralDraft: '',
    patientInstructions: '',
    followUps: [],
    redFlags: [],
    fullText,
  };
}

function composeFullText(note: Omit<ConsultScribeNote, 'fullText'>): string {
  const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n');
  const soapParts = [
    note.subjective ? `Subjective\n${note.subjective}` : null,
    note.objective ? `Objective\n${note.objective}` : null,
    note.assessment ? `Assessment\n${note.assessment}` : null,
    note.plan ? `Plan\n${note.plan}` : null,
  ].filter(Boolean);
  return [
    note.summary ? `Visit summary\n${note.summary}` : null,
    note.keyPoints.length ? `Discussed in the visit\n${bullets(note.keyPoints)}` : null,
    soapParts.length ? soapParts.join('\n\n') : null,
    note.followUps.length ? `Follow-ups\n${bullets(note.followUps)}` : null,
    note.redFlags.length ? `Red flags\n${bullets(note.redFlags)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** House style has no em dashes; the model still slips them in. */
function withoutEmDashes(text: string): string {
  return text.replace(/\s*\u2014\s*/g, ', ');
}

export function parseConsultScribeNote(raw: string): ConsultScribeNote {
  const text = withoutEmDashes(raw.trim());
  const note = {
    summary: sectionBody(text, 'SUMMARY'),
    keyPoints: parseList(sectionBody(text, 'KEY_POINTS')),
    subjective: sectionBody(text, 'SUBJECTIVE'),
    objective: sectionBody(text, 'OBJECTIVE'),
    assessment: sectionBody(text, 'ASSESSMENT'),
    plan: sectionBody(text, 'PLAN'),
    prescriptionDraft: sectionBody(text, 'PRESCRIPTION_DRAFT'),
    referralDraft: sectionBody(text, 'REFERRAL_DRAFT'),
    patientInstructions: sectionBody(text, 'PATIENT_INSTRUCTIONS'),
    followUps: parseList(sectionBody(text, 'FOLLOW_UPS') || sectionBody(text, 'FOLLOW-UPS')),
    redFlags: parseList(sectionBody(text, 'RED_FLAGS')),
  };

  const hasStructured = Object.values(note).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  if (!hasStructured) return emptyNote(text);
  return { ...note, fullText: composeFullText(note) || text };
}

type ScribeActionLike = {
  content: string;
  metadata?: Record<string, string | number | boolean | null>;
};

const LIST_SEPARATOR = '|';

/** Flatten a note into post-consult action metadata (string values only). */
export function scribeNoteToMetadata(
  note: ConsultScribeNote,
): Record<string, string> {
  return {
    summary: note.summary,
    keyPoints: note.keyPoints.join(LIST_SEPARATOR),
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    prescriptionDraft: note.prescriptionDraft,
    referralDraft: note.referralDraft,
    patientInstructions: note.patientInstructions,
    followUps: note.followUps.join(LIST_SEPARATOR),
    redFlags: note.redFlags.join(LIST_SEPARATOR),
  };
}

/** Build a structured scribe note from a saved post-consult action. */
export function scribeNoteFromAction(action: ScribeActionLike): ConsultScribeNote {
  const meta = action.metadata ?? {};
  const text = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string) : '');
  const list = (key: string) => text(key).split(LIST_SEPARATOR).filter(Boolean);

  const note = {
    summary: text('summary'),
    keyPoints: list('keyPoints'),
    subjective: text('subjective'),
    objective: text('objective'),
    assessment: text('assessment'),
    plan: text('plan'),
    prescriptionDraft: text('prescriptionDraft'),
    referralDraft: text('referralDraft'),
    patientInstructions: text('patientInstructions'),
    followUps: list('followUps'),
    redFlags: list('redFlags'),
  };
  const hasMetadata = Object.values(note).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  if (hasMetadata) return { ...note, fullText: action.content.trim() };
  return parseConsultScribeNote(action.content);
}
