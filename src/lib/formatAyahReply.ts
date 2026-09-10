/** Plain-text cleanup for Ayah replies, no markdown symbols in the UI. */
export function formatAyahReply(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-{3,}\s*$/gm, '')
    .replace(/\s-{3,}\s*/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/[\u2014\u2013]+/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type AyahBriefingBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string };

const HEADING_PREFIX =
  /^(?:🌟|☀️|🔴|📅|✅|⚠️|💊|📋|🏥|📊|👥|📝)\s*/u;

const HEADING_PHRASE =
  /^(?:good morning|good afternoon|good evening|practice briefing|needs your attention|today'?s appointments|practice health|one thing to do|inbox|panel overview|quick stats|today|attention|upcoming|pre-visit brief|why they'?re here|what changed|important history|recent results|current treatment|open issues|things to clarify|30-second brief|patient overview|changes since last visit|new|unresolved|unchanged|who|why today|key history|recent change|important results|open issue|suggested focus|possible considerations|result review|care plan draft|ai-generated draft|current record|patient reports|possible discrepancy|previous|change|relevant context|recommended review|trends|follow-up|questions to clarify|patient handoff|referral draft|patient instructions)/i;

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HEADING_PREFIX.test(trimmed)) return true;
  if (/^[A-Z0-9][A-Z0-9\s'&/-]{2,}$/.test(trimmed) && trimmed.length < 72) return true;
  if (/^[A-Z][^.!?]*:$/.test(trimmed) && trimmed.length < 64) return true;
  if (HEADING_PHRASE.test(trimmed)) {
    return trimmed.length < 48 || /:$/.test(trimmed);
  }
  return false;
}

function headingText(line: string): string {
  return line
    .trim()
    .replace(HEADING_PREFIX, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

export function parseAyahBriefing(text: string): AyahBriefingBlock[] {
  const cleaned = formatAyahReply(text);
  if (!cleaned) return [];

  const blocks: AyahBriefingBlock[] = [];
  const lines = cleaned.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeadingLine(line)) {
      blocks.push({
        type: 'heading',
        text: headingText(line) || line,
      });
      continue;
    }

    if (line.startsWith('• ')) {
      blocks.push({ type: 'bullet', text: line.slice(2).trim() });
      continue;
    }

    blocks.push({ type: 'paragraph', text: line });
  }

  return blocks;
}

export function formatAyahMessageContent(
  role: 'user' | 'assistant',
  content: string,
): string {
  if (role !== 'assistant') return content.trim();
  return formatAyahReply(content);
}
