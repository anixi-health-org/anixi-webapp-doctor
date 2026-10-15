/** Mirrors backend format_patient_display_name for local PDF/CSV previews. */
export function formatPatientDisplayName(value?: string | null): string {
  const raw = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';

  let normalized = raw;
  if (raw.includes(',')) {
    const [left, right] = raw.split(',', 2).map((part) => part.trim());
    if (left && right) {
      normalized = `${right} ${left}`.trim();
    }
  } else if (raw === raw.toUpperCase() && raw.split(/\s+/).length >= 2) {
    const tokens = raw.split(/\s+/);
    const surname = tokens[0];
    const given = tokens.slice(1).join(' ');
    normalized = `${given} ${surname}`.trim();
  }

  if (normalized !== normalized.toUpperCase()) {
    return normalized;
  }

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function unichartsChartNameLabel(
  displayName?: string | null,
  storedChartName?: string | null,
): string {
  const stored = (storedChartName ?? '').trim();
  if (stored) return stored;
  const formatted = formatPatientDisplayName(displayName);
  const tokens = formatted.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return formatted.toUpperCase();
  const surname = tokens[tokens.length - 1];
  const given = tokens.slice(0, -1).join(' ');
  return `${surname.toUpperCase()} ${given.toUpperCase()}`.trim();
}
