/**
 * Doctor portal helpers for scoped medical-record shares.
 * Keep logic aligned with mobile `medical-record-shares/lib/*`.
 */

export type MedicalRecordScopeKey =
  | 'consultations'
  | 'healthConditions'
  | 'medications'
  | 'allergies'
  | 'surgeries'
  | 'bloodTests'
  | 'xrays'
  | 'notes'
  | 'vitals';

export type MedicalRecordScope = Record<MedicalRecordScopeKey, boolean>;

export const MEDICAL_RECORD_SCOPE_KEYS: MedicalRecordScopeKey[] = [
  'consultations',
  'healthConditions',
  'medications',
  'allergies',
  'surgeries',
  'bloodTests',
  'xrays',
  'notes',
  'vitals',
];

export const MEDICAL_RECORD_SCOPE_LABELS: Record<MedicalRecordScopeKey, string> = {
  consultations: 'Consultation history',
  healthConditions: 'Health conditions',
  medications: 'Medications',
  allergies: 'Allergies',
  surgeries: 'Previous surgeries',
  bloodTests: 'Blood Tests',
  xrays: 'X-rays & Scans',
  notes: 'Medical Notes',
  vitals: 'Health measurements',
};

export function selectedScopeLabels(
  scope: Partial<MedicalRecordScope> | null | undefined
): string[] {
  if (!scope) return [];
  return MEDICAL_RECORD_SCOPE_KEYS.filter((key) => scope[key] === true).map(
    (key) => MEDICAL_RECORD_SCOPE_LABELS[key]
  );
}

export type AccessDurationPreset =
  | 'until_revoked'
  | '7_days'
  | '30_days'
  | '90_days'
  | 'custom';

const PRESET_DAYS: Record<AccessDurationPreset, number | null> = {
  until_revoked: null,
  '7_days': 7,
  '30_days': 30,
  '90_days': 90,
  custom: null,
};

/** Mirrors mobile `medical-record-shares/lib/duration.ts` — access starts at approval. */
export function computeShareExpiresAt(
  preset: AccessDurationPreset,
  from: Date,
  customDays?: number | null
): Date | null {
  const days =
    preset === 'custom'
      ? typeof customDays === 'number' && customDays > 0
        ? customDays
        : null
      : PRESET_DAYS[preset];

  if (days == null) return null;

  const expires = new Date(from.getTime());
  expires.setDate(expires.getDate() + days);
  return expires;
}

export function formatShareDurationLabel(
  preset: AccessDurationPreset,
  customDays?: number | null
): string {
  switch (preset) {
    case 'until_revoked':
      return 'Until the patient revokes';
    case 'custom':
      return customDays && customDays > 0 ? `${customDays} days` : 'Custom';
    default:
      return `${PRESET_DAYS[preset]} days`;
  }
}

const FILE_CATEGORY_TO_SCOPE: Record<string, MedicalRecordScopeKey> = {
  xrays: 'xrays',
  blood_tests: 'bloodTests',
  notes: 'notes',
};

export function isSharePermissionActive(input: {
  status?: string;
  expiresAt?: Date | null;
  now?: Date;
}): boolean {
  if (input.status !== 'approved') return false;
  const now = input.now ?? new Date();
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export function canAccessMedicalFileCategory(input: {
  hasApprovedShareConnection: boolean;
  scope?: Partial<MedicalRecordScope> | null;
  status?: string;
  expiresAt?: Date | null;
  category: string;
  now?: Date;
}): boolean {
  if (input.hasApprovedShareConnection) return true;
  if (!isSharePermissionActive(input)) return false;
  const key = FILE_CATEGORY_TO_SCOPE[input.category];
  if (!key) return false;
  return input.scope?.[key] === true;
}
