/** Hide Django auth-only / roster placeholder emails in clinic UI. */
export function sanitizeContactEmail(email: string | undefined | null): string {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return '';
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('roster+')) {
    return '';
  }
  if (
    lower.endsWith('@internal.anixi.health') ||
    lower.endsWith('@pending.anixi.health') ||
    lower.endsWith('@users.anixihealth.com')
  ) {
    return '';
  }
  return trimmed;
}
