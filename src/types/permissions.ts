export type DelegatePermissions = {
  manageAppointments: boolean;
  manageSoftBlocks: boolean;
  overrideConflicts: boolean;
  editBookingPolicies: boolean;
};

export type DelegateStatus = 'pending' | 'active' | 'inactive';

export interface DelegateUser {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  role: 'delegate';
  permissions: DelegatePermissions;
  invitedAt?: string;
  acceptedAt?: string;
  status: DelegateStatus;
}

export interface PracticePermissionsDocument {
  ownerId: string;
  delegates: DelegateUser[];
  defaultDelegatePermissions: DelegatePermissions;
}
