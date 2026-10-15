/** Match Django `format_sa_phone_display` for list views. */
export function formatSaPhoneDisplay(value?: string | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  let national = digits;
  if (national.startsWith('27') && national.length >= 11) {
    national = `0${national.slice(2, 12)}`;
  }
  if (national.length > 10 && national.startsWith('0')) {
    national = national.slice(0, 10);
  }
  if (national.length === 10 && national.startsWith('0')) {
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 10)}`;
  }
  return raw.replace(/\b(?:Guarantor|Information)\b/gi, '').trim();
}

export function formatSaPhoneE164Display(e164?: string | null): string {
  const raw = (e164 || '').trim();
  if (!raw.startsWith('+27') || raw.length < 12) return raw;
  const national = raw.slice(3);
  if (national.length >= 9) {
    return `+27 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 9)}`;
  }
  return raw;
}

/** Single-line +27 display for roster tables (prefers E.164 from API). */
export function formatSaPhoneIntlDisplay(
  phoneE164?: string | null,
  phoneNumber?: string | null,
): string {
  const e164 = (phoneE164 || '').trim();
  if (e164.startsWith('+27')) {
    return formatSaPhoneE164Display(e164);
  }
  const raw = (phoneNumber || '').trim();
  if (!raw) return e164 ? formatSaPhoneE164Display(e164) : '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length >= 11) {
    return formatSaPhoneE164Display(`+${digits.slice(0, 11)}`);
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return formatSaPhoneE164Display(`+27${digits.slice(1, 10)}`);
  }
  if (raw.startsWith('+')) {
    return formatSaPhoneE164Display(raw);
  }
  return raw.replace(/\b(?:Guarantor|Information)\b/gi, '').trim();
}

export type WhatsAppRosterStatus =
  | 'verified'
  | 'reachable'
  | 'not_on_whatsapp'
  | 'unknown'
  | 'invalid';

export function whatsAppRosterLabel(status?: WhatsAppRosterStatus | null): string {
  switch (status) {
    case 'verified':
      return 'Verified on WhatsApp';
    case 'reachable':
      return 'On WhatsApp';
    case 'not_on_whatsapp':
      return 'Not on WhatsApp';
    case 'invalid':
      return 'Invalid number';
    default:
      return 'Not checked yet';
  }
}
