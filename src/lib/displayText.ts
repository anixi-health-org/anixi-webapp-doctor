/** Shown when a table cell or stat has no value. Never use an em dash. */
export const EMPTY_DISPLAY = '-';

/** Replace em/en dashes in user-visible copy with plain punctuation. */
export function stripEmDash(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/[\u2014\u2013]/g, '-');
}
