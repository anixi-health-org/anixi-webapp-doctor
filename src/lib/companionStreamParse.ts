/** Parse Mastra / Django companion SSE lines into assistant text deltas. */

const TEXT_EVENT_TYPES = new Set(['text-delta', 'text', 'output-text-delta']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

function extractTextFromEvent(parsed: Record<string, unknown>): string {
  if (parsed.type === 'error') {
    const inner = isRecord(parsed.payload) ? parsed.payload : parsed;
    const message =
      firstString(
        isRecord(inner.error) ? inner.error.message : undefined,
        inner.message,
        parsed.message,
      ) || 'Ayah stream error';
    throw new Error(message);
  }

  const payload = isRecord(parsed.payload) ? parsed.payload : undefined;
  const eventType = firstString(parsed.type, payload?.type);
  if (!TEXT_EVENT_TYPES.has(eventType)) return '';

  return firstString(
    parsed.text,
    parsed.delta,
    typeof parsed.content === 'string' ? parsed.content : undefined,
    payload?.text,
    payload?.delta,
    typeof payload?.content === 'string' ? payload.content : undefined,
  );
}

/** Pull only assistant text from one SSE / NDJSON line. Never returns raw events. */
export function parseCompanionStreamLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '[DONE]') return '';
  if (
    trimmed.startsWith('event:') ||
    trimmed.startsWith('id:') ||
    trimmed.startsWith('retry:')
  ) {
    return '';
  }

  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!payload || payload === '[DONE]') return '';
  if (!payload.startsWith('{')) return '';

  try {
    return extractTextFromEvent(JSON.parse(payload) as Record<string, unknown>);
  } catch (err) {
    if (err instanceof Error && err.message !== payload && !err.message.startsWith('{')) {
      throw err;
    }
    return '';
  }
}
