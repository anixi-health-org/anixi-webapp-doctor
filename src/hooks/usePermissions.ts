import { useAuth } from './AuthContext';
import { PracticePermissions, PracticeRole } from '../types';
import { EMPTY_PERMISSIONS } from '../lib/practiceRoles';

export const usePermissions = () => {
  const { practiceSession } = useAuth();
  const permissions = practiceSession?.member?.permissions ?? EMPTY_PERMISSIONS;
  const role: PracticeRole | null = practiceSession?.member?.role ?? null;
  const orgType = practiceSession?.practice?.orgType ?? 'solo';

  return {
    role,
    permissions,
    orgType,
    isOwner: role === 'owner',
    isPracticeManager: role === 'practice_manager' || role === 'owner',
    isDelegate: role === 'delegate',
    isClinician: Boolean(practiceSession?.member?.isClinician),
    isClinic: orgType === 'clinic',
    can: (permission: keyof PracticePermissions): boolean => Boolean(permissions[permission]),
    canManageMembers: Boolean(permissions.manageMembers) || role === 'owner',
  };
};
