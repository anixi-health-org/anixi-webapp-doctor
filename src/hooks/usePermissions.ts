import { useAuth } from './AuthContext';
import { PracticePermissions, PracticeRole } from '../types';
import { EMPTY_PERMISSIONS, normalizePermissions } from '../lib/practiceRoles';
import {
  canManageOperationalSettings,
  isClinicEmployedClinician,
} from '../lib/doctorAccess';

export const usePermissions = () => {
  const { practiceSession } = useAuth();
  const role: PracticeRole | null = practiceSession?.member?.role ?? null;
  const rawPermissions = practiceSession?.member?.permissions;
  const permissions =
    role != null
      ? normalizePermissions(rawPermissions ?? undefined, role)
      : EMPTY_PERMISSIONS;
  const orgType = practiceSession?.practice?.orgType ?? 'solo';
  const clinicEmployed = isClinicEmployedClinician(practiceSession);
  const canManageOps = canManageOperationalSettings(practiceSession);
  const isOwner = role === 'owner';

  return {
    role,
    permissions,
    orgType,
    isOwner,
    isPracticeManager: role === 'practice_manager' || role === 'owner',
    isDelegate: role === 'delegate',
    isClinician: Boolean(practiceSession?.member?.isClinician),
    isClinic: orgType === 'clinic',
    isClinicEmployedClinician: clinicEmployed,
    canManageOperationalSettings: canManageOps,
    can: (permission: keyof PracticePermissions): boolean => {
      if (isOwner) return true;
      return Boolean(permissions[permission]);
    },
    canManageMembers: Boolean(permissions.manageMembers) || isOwner,
  };
};
