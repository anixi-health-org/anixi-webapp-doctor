import { useAuth } from './AuthContext';
import { PracticePermissions, PracticeRole } from '../types';
import {
  EMPTY_PERMISSIONS,
  memberHasRole,
  normalizeMemberRoles,
  normalizePermissions,
} from '../lib/practiceRoles';
import {
  canManageOperationalSettings,
  isClinicEmployedClinician,
  isManagedOrgType,
} from '../lib/doctorAccess';

export const usePermissions = () => {
  const { practiceSession, joinIntent, user } = useAuth();
  const member = practiceSession?.member;
  const role: PracticeRole | null = member?.role ?? null;
  const roles =
    member && role != null ? normalizeMemberRoles(role, member.roles) : [];
  const rawPermissions = member?.permissions;
  const permissions =
    roles.length > 0
      ? normalizePermissions(rawPermissions ?? undefined, roles)
      : EMPTY_PERMISSIONS;
  const orgType = practiceSession?.practice?.orgType ?? 'solo';
  const clinicEmployed = isClinicEmployedClinician(practiceSession, {
    joinIntent,
    accountKind: user && 'accountKind' in user ? user.accountKind : undefined,
  });
  const canManageOps = canManageOperationalSettings(practiceSession);
  const isOwner = memberHasRole({ role: role ?? 'delegate', roles }, 'owner');
  const isAdministrator =
    isOwner || memberHasRole({ role: role ?? 'delegate', roles }, 'administrator');

  return {
    role,
    roles,
    permissions,
    orgType,
    isOwner,
    isAdministrator,
    isPracticeManager:
      isOwner ||
      memberHasRole({ role: role ?? 'delegate', roles }, 'practice_manager', 'administrator'),
    isDelegate: memberHasRole({ role: role ?? 'delegate', roles }, 'delegate') && roles.length === 1,
    isClinician:
      Boolean(member?.isClinician) ||
      roles.some((r) => r === 'doctor' || r === 'nurse' || r === 'clinical_associate' || r === 'allied_health' || r === 'locum'),
    isClinic: isManagedOrgType(orgType),
    isClinicEmployedClinician: clinicEmployed,
    canManageOperationalSettings: canManageOps,
    can: (permission: keyof PracticePermissions): boolean => {
      if (isOwner || isAdministrator) return true;
      return Boolean(permissions[permission]);
    },
    hasRole: (check: PracticeRole) =>
      memberHasRole({ role: role ?? 'delegate', roles }, check),
    canManageMembers: Boolean(permissions.manageMembers) || isOwner || isAdministrator,
    canManageContent: Boolean(permissions.manageContent) || isOwner || isAdministrator,
  };
};
