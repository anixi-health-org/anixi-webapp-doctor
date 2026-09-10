export type ConsultScribeNote = {
  summary: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  followUps: string[];
  fullText: string;
};

const SECTION_HEADERS = [
  'SUMMARY',
  'SUBJECTIVE',
  'OBJECTIVE',
  'ASSESSMENT',
  'PLAN',
  'FOLLOW_UPS',
  'FOLLOW-UPS',
] as const;

function sectionBody(text: string, header: string): string {
  const pattern = new RegExp(
    `${header}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${SECTION_HEADERS.join('|')})\\s*:?\\s|$)`,
    'i',
  );
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function parseFollowUps(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

export function parseConsultScribeNote(raw: string): ConsultScribeNote {
  const text = raw.trim();
  const summary = sectionBody(text, 'SUMMARY');
  const subjective = sectionBody(text, 'SUBJECTIVE');
  const objective = sectionBody(text, 'OBJECTIVE');
  const assessment = sectionBody(text, 'ASSESSMENT');
  const plan = sectionBody(text, 'PLAN');
  const followUpsRaw =
    sectionBody(text, 'FOLLOW_UPS') || sectionBody(text, 'FOLLOW-UPS');
  const followUps = parseFollowUps(followUpsRaw);

  const hasStructured =
    summary || subjective || objective || assessment || plan || followUps.length > 0;

  if (!hasStructured) {
    return {
      summary: text.slice(0, 280),
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      followUps: [],
      fullText: text,
    };
  }

  const soapParts = [
    subjective ? `Subjective\n${subjective}` : null,
    objective ? `Objective\n${objective}` : null,
    assessment ? `Assessment\n${assessment}` : null,
    plan ? `Plan\n${plan}` : null,
  ].filter(Boolean);

  const fullText = [
    summary ? `Visit summary\n${summary}` : null,
    soapParts.length ? soapParts.join('\n\n') : null,
    followUps.length
      ? `Follow-ups\n${followUps.map((item) => `- ${item}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    summary,
    subjective,
    objective,
    assessment,
    plan,
    followUps,
    fullText: fullText || text,
  };
}

type ScribeActionLike = {
  content: string;
  metadata?: Record<string, string | number | boolean | null>;
};

/** Build a structured scribe note from a saved post-consult action. */
export function scribeNoteFromAction(action: ScribeActionLike): ConsultScribeNote {
  const meta = action.metadata ?? {};
  const summary = typeof meta.summary === 'string' ? meta.summary : '';
  const subjective = typeof meta.subjective === 'string' ? meta.subjective : '';
  const objective = typeof meta.objective === 'string' ? meta.objective : '';
  const assessment = typeof meta.assessment === 'string' ? meta.assessment : '';
  const plan = typeof meta.plan === 'string' ? meta.plan : '';
  const followUpsRaw = typeof meta.followUps === 'string' ? meta.followUps : '';
  const followUps = followUpsRaw ? followUpsRaw.split('|').filter(Boolean) : [];

  const hasMetadata =
    summary || subjective || objective || assessment || plan || followUps.length > 0;

  if (hasMetadata) {
    return {
      summary,
      subjective,
      objective,
      assessment,
      plan,
      followUps,
      fullText: action.content.trim(),
    };
  }

  return parseConsultScribeNote(action.content);
}
