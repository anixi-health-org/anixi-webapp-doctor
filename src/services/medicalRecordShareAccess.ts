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
