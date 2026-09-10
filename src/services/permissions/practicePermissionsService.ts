import { getPracticeByOwnerId } from '../practiceSettingsService';
import {
  djangoAcceptPracticeInvite,
  djangoCreatePracticeInvite,
  djangoFetchPracticeMembers,
  djangoRevokePracticeInvite,
  isDjangoApiEnabled,
} from '../djangoApiService';
import { normalizePermissions } from '../../lib/practiceRoles';
import { DelegatePermissions, DelegateUser, PracticePermissionsDocument } from '../../types/permissions';
import type { PracticePermissions } from '../../types';

const DEFAULT_DELEGATE_PERMISSIONS: DelegatePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
};

function toDelegatePermissions(perms: PracticePermissions): DelegatePermissions {
  return {
    manageAppointments: perms.manageAppointments,
    manageSoftBlocks: perms.manageSoftBlocks,
    overrideConflicts: perms.overrideConflicts,
    editBookingPolicies: perms.editBookingPolicies,
  };
}

function mapMembersToPermissions(
  doctorId: string,
  members: Array<Record<string, unknown>>,
): PracticePermissionsDocument {
  const delegates = members
    .filter((member) => member.role === 'delegate')
    .map(
      (member): DelegateUser => ({
        id: String(member.uid ?? member.id ?? ''),
        userId: String(member.uid ?? ''),
        email: String(member.email ?? ''),
        displayName:
          typeof member.displayName === 'string' ? member.displayName : undefined,
        role: 'delegate',
        permissions: (member.permissions as DelegatePermissions) ?? {
          ...DEFAULT_DELEGATE_PERMISSIONS,
        },
        invitedAt: String(member.createdAt ?? new Date().toISOString()),
        status: member.status === 'active' ? 'active' : 'pending',
      }),
    );

  return {
    ownerId: doctorId,
    delegates,
    defaultDelegatePermissions: { ...DEFAULT_DELEGATE_PERMISSIONS },
  };
}

export const generateDelegateInviteId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `delegate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const getPracticePermissions = async (
  doctorId: string,
): Promise<PracticePermissionsDocument | null> => {
  if (!doctorId) return null;

  if (isDjangoApiEnabled()) {
    const practice = await getPracticeByOwnerId(doctorId);
    if (!practice?.id) {
      return {
        ownerId: doctorId,
        delegates: [],
        defaultDelegatePermissions: { ...DEFAULT_DELEGATE_PERMISSIONS },
      };
    }
    const members = await djangoFetchPracticeMembers(practice.id);
    return mapMembersToPermissions(doctorId, members);
  }

  return {
    ownerId: doctorId,
    delegates: [],
    defaultDelegatePermissions: { ...DEFAULT_DELEGATE_PERMISSIONS },
  };
};

export const ensurePracticePermissions = async (
  doctorId: string,
): Promise<PracticePermissionsDocument> => {
  const existing = await getPracticePermissions(doctorId);
  return (
    existing ?? {
      ownerId: doctorId,
      delegates: [],
      defaultDelegatePermissions: { ...DEFAULT_DELEGATE_PERMISSIONS },
    }
  );
};

export interface InviteDelegateInput {
  email: string;
  displayName?: string;
  permissions?: Partial<DelegatePermissions>;
}

export const inviteDelegate = async (
  doctorId: string,
  input: InviteDelegateInput,
): Promise<{ delegateId: string; delegate: DelegateUser }> => {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  const invitePermissions = normalizePermissions(input.permissions, 'delegate');
  const delegatePermissions = toDelegatePermissions(invitePermissions);

  if (isDjangoApiEnabled()) {
    const practice = await getPracticeByOwnerId(doctorId);
    if (!practice?.id) throw new Error('Practice not found');
    const invite = await djangoCreatePracticeInvite(practice.id, {
      email,
      displayName: input.displayName,
      role: 'delegate',
      permissions: invitePermissions,
    });
    const delegateId = String(invite.id);
    return {
      delegateId,
      delegate: {
        id: delegateId,
        userId: '',
        email,
        displayName: input.displayName?.trim() || undefined,
        role: 'delegate',
        permissions: delegatePermissions,
        invitedAt: new Date().toISOString(),
        status: 'pending',
      },
    };
  }

  const delegateId = generateDelegateInviteId();
  return {
    delegateId,
    delegate: {
      id: delegateId,
      userId: '',
      email,
      displayName: input.displayName?.trim() || undefined,
      role: 'delegate',
      permissions: delegatePermissions,
      invitedAt: new Date().toISOString(),
      status: 'pending',
    },
  };
};

export const acceptDelegateInvitation = async (
  doctorId: string,
  delegateId: string,
  acceptingUser: { uid: string; email?: string | null; displayName?: string | null },
  options?: { practiceId?: string; token?: string },
): Promise<void> => {
  void acceptingUser;
  if (!doctorId || !delegateId) {
    throw new Error('Invalid invitation link');
  }

  if (isDjangoApiEnabled()) {
    const practice = options?.practiceId
      ? { id: options.practiceId }
      : await getPracticeByOwnerId(doctorId);
    if (!practice?.id) throw new Error('Practice not found');
    if (!options?.token) throw new Error('Invitation token is required');
    await djangoAcceptPracticeInvite({
      practiceId: practice.id,
      inviteId: delegateId,
      token: options.token,
    });
    return;
  }

  await linkDelegateToDoctor(acceptingUser.uid, doctorId, undefined);
};

async function linkDelegateToDoctor(
  _delegateUid: string,
  _doctorId: string,
  _delegate?: DelegateUser,
): Promise<void> {
  // Membership is persisted by djangoAcceptPracticeInvite when Django API is enabled.
}

export const deactivateDelegate = async (
  doctorId: string,
  delegateId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    const practice = await getPracticeByOwnerId(doctorId);
    if (!practice?.id) return;
    await djangoRevokePracticeInvite(practice.id, delegateId);
  }
};

export type PermissionKey = keyof DelegatePermissions;

export const checkUserPermission = async (
  doctorId: string,
  userId: string,
  permissionKey: PermissionKey,
): Promise<boolean> => {
  if (!doctorId || !userId) return false;
  if (userId === doctorId) return true;

  const permissions = await getPracticePermissions(doctorId);
  if (!permissions) return false;

  const delegate = permissions.delegates.find(
    (d) => d.userId === userId && d.status === 'active',
  );
  if (!delegate) return false;

  return Boolean(delegate.permissions[permissionKey]);
};

export const getActiveDelegates = (
  permissions: PracticePermissionsDocument,
): DelegateUser[] =>
  permissions.delegates.filter(
    (d) => d.status === 'active' || d.status === 'pending',
  );

export const resolveEffectivePermissions = async (
  doctorId: string,
  userId: string,
): Promise<{ isOwner: boolean; permissions: DelegatePermissions }> => {
  const full: DelegatePermissions = {
    manageAppointments: true,
    manageSoftBlocks: true,
    overrideConflicts: true,
    editBookingPolicies: true,
  };

  if (userId === doctorId) {
    return { isOwner: true, permissions: full };
  }

  const docData = await getPracticePermissions(doctorId);
  const delegate = docData?.delegates.find(
    (d) => d.userId === userId && d.status === 'active',
  );

  if (!delegate) {
    return {
      isOwner: false,
      permissions: {
        manageAppointments: false,
        manageSoftBlocks: false,
        overrideConflicts: false,
        editBookingPolicies: false,
      },
    };
  }

  return { isOwner: false, permissions: delegate.permissions };
};
