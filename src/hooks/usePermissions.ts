import { useAuth } from './AuthContext';
import { PracticePermissions } from '../types';

const NO_PERMISSIONS: PracticePermissions = {
  manageAppointments: false,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
};

export const usePermissions = () => {
  const { practiceSession } = useAuth();
  const permissions = practiceSession?.member?.permissions ?? NO_PERMISSIONS;
  const role = practiceSession?.member?.role ?? null;

  return {
    role,
    permissions,
    isOwner: role === 'owner',
    isDelegate: role === 'delegate',
    can: (permission: keyof PracticePermissions): boolean => permissions[permission],
  };
};
