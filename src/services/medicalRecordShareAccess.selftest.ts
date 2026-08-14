import {
  canAccessMedicalFileCategory,
  isSharePermissionActive,
} from './medicalRecordShareAccess';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-08-14T12:00:00.000Z');

assert(
  isSharePermissionActive({ status: 'pending', expiresAt: null, now }) === false,
  'pending inactive',
);
assert(
  isSharePermissionActive({
    status: 'approved',
    expiresAt: new Date('2026-09-01'),
    now,
  }) === true,
  'approved active',
);
assert(
  isSharePermissionActive({
    status: 'approved',
    expiresAt: new Date('2026-08-01'),
    now,
  }) === false,
  'expired inactive',
);

assert(
  canAccessMedicalFileCategory({
    hasApprovedShareConnection: true,
    category: 'xrays',
  }) === true,
  'connection full access',
);

assert(
  canAccessMedicalFileCategory({
    hasApprovedShareConnection: false,
    status: 'approved',
    expiresAt: new Date('2026-09-01'),
    scope: { bloodTests: true },
    category: 'blood_tests',
    now,
  }) === true,
  'scoped blood tests allowed',
);

assert(
  canAccessMedicalFileCategory({
    hasApprovedShareConnection: false,
    status: 'approved',
    expiresAt: new Date('2026-09-01'),
    scope: { bloodTests: true },
    category: 'xrays',
    now,
  }) === false,
  'scoped xrays blocked',
);

assert(
  canAccessMedicalFileCategory({
    hasApprovedShareConnection: false,
    status: 'revoked',
    scope: { xrays: true },
    category: 'xrays',
    now,
  }) === false,
  'revoked blocked',
);

console.log('PASS medicalRecordShareAccess tests');
