const TITLE_PREFIX = /^(dr\.?|doctor)(\s+|$)/i;

export function clinicianDisplayName(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Doctor';
  if (TITLE_PREFIX.test(trimmed)) {
    return trimmed.replace(/^dr(?=\.|\s|$)/i, 'Dr');
  }
  return `Dr. ${trimmed}`;
}

export function clinicianGivenName(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Doctor';
  const withoutTitle = trimmed.replace(TITLE_PREFIX, '').trim();
  const given = withoutTitle.split(/\s+/)[0];
  if (!given || /^dr\.?$/i.test(given)) return 'Doctor';
  return given;
}

export function clinicianHeaderLabel(name?: string | null): string {
  const given = clinicianGivenName(name);
  if (given === 'Doctor') return 'Doctor';
  return `Dr. ${given}`;
}
