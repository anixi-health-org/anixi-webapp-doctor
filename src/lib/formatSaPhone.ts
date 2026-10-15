/** Match Django `format_sa_phone_display` for list views. */
export function formatSaPhoneDisplay(value?: string | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  let national = digits;
  if (national.startsWith('27') && national.length >= 11) {
    national = `0${national.slice(2, 12)}`;
  }
  if (national.length === 10 && national.startsWith('0')) {
    return `(${national.slice(0, 3)})${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return raw.replace(/\b(?:Guarantor|Information)\b/gi, '').trim();
}
