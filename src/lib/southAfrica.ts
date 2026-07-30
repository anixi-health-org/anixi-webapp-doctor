export const SA_PROVINCES = [
  { value: 'eastern cape', label: 'Eastern Cape' },
  { value: 'free state', label: 'Free State' },
  { value: 'gauteng', label: 'Gauteng' },
  { value: 'kwazulu-natal', label: 'KwaZulu-Natal' },
  { value: 'limpopo', label: 'Limpopo' },
  { value: 'mpumalanga', label: 'Mpumalanga' },
  { value: 'northern cape', label: 'Northern Cape' },
  { value: 'north west', label: 'North West' },
  { value: 'western cape', label: 'Western Cape' },
] as const;

export const SA_MEDICAL_SCHEMES = [
  'Discovery Health',
  'Bonitas',
  'Momentum Health',
  'Medscheme',
  'GEMS',
  'Fedhealth',
  'Bestmed',
  'Medihelp',
  'KeyHealth',
  'Other',
] as const;

export const SA_VAT_RATE = 0.15;

export function computeVatBreakdown(
  subtotalExVat: number,
  vatRate: number = SA_VAT_RATE
): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = Math.round(subtotalExVat * 100) / 100;
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatAmount, total };
}

export function validateSouthAfricanId(id: string): { valid: boolean; error?: string } {
  const trimmed = id.replace(/\s/g, '');
  if (!/^\d{13}$/.test(trimmed)) {
    return { valid: false, error: 'South African ID must be exactly 13 digits' };
  }

  const yearPart = parseInt(trimmed.slice(0, 2), 10);
  const month = parseInt(trimmed.slice(2, 4), 10);
  const day = parseInt(trimmed.slice(4, 6), 10);

  const currentYearSuffix = new Date().getFullYear() % 100;
  const fullYear = yearPart <= currentYearSuffix ? 2000 + yearPart : 1900 + yearPart;
  const dob = new Date(fullYear, month - 1, day);
  if (
    dob.getFullYear() !== fullYear ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return { valid: false, error: 'Invalid date of birth in ID number' };
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let digit = parseInt(trimmed.charAt(i), 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== parseInt(trimmed.charAt(12), 10)) {
    return { valid: false, error: 'Invalid ID number checksum' };
  }

  return { valid: true };
}

export function normalizeSaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();

  if (digits.startsWith('27') && digits.length >= 11) {
    return `+${digits.slice(0, 11)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+27${digits}`;
  }
  if (phone.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return phone.trim();
}

export function formatSaPhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;

  let local = digits;
  if (local.startsWith('27') && local.length >= 11) {
    local = `0${local.slice(2, 12)}`;
  } else if (local.length === 9) {
    local = `0${local}`;
  }

  if (local.length === 10 && local.startsWith('0')) {
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  if (digits.startsWith('27') && digits.length >= 11) {
    const national = digits.slice(2, 12);
    return `+27 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }

  return phone.trim();
}

export const COMMON_ICD10_CODES: { code: string; description: string }[] = [
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'J00', description: 'Acute nasopharyngitis (common cold)' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'E78.5', description: 'Hyperlipidaemia, unspecified' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'M79.3', description: 'Panniculitis, unspecified' },
  { code: 'R51', description: 'Headache' },
  { code: 'R10.4', description: 'Other and unspecified abdominal pain' },
  { code: 'R50.9', description: 'Fever, unspecified' },
  { code: 'K21.9', description: 'Gastro-oesophageal reflux disease without oesophagitis' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
  { code: 'L30.9', description: 'Dermatitis, unspecified' },
  { code: 'H10.9', description: 'Conjunctivitis, unspecified' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
  { code: 'F32.9', description: 'Depressive episode, unspecified' },
  { code: 'B34.9', description: 'Viral infection, unspecified' },
  { code: 'Z00.0', description: 'General adult medical examination' },
  { code: 'Z23', description: 'Encounter for immunisation' },
  { code: 'Z71.9', description: 'Counselling, unspecified' },
  { code: 'S61.0', description: 'Open wound of finger without damage to nail' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified' },
];

export function isValidNappiCode(code: string): boolean {
  const trimmed = code.trim();
  return /^\d{5,7}$/.test(trimmed);
}
