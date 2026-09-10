import { isClinicianRole, normalizePermissions, permissionsForRole } from '../lib/practiceRoles';
import {
  djangoAcceptPracticeInvite,
  djangoCreatePracticeInvite,
  djangoGetPracticeInvite,
  djangoListPracticeInvites,
  djangoNotifyClinicLiveInvites,
  djangoResendPracticeInvite,
  djangoRevokePracticeInvite,
  isDjangoApiEnabled,
} from './djangoApiService';
import type { PracticeInvite, PracticeMember, PracticePermissions, PracticeRole } from '../types';

const toDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (v && typeof v === 'object' && 'seconds' in v) {
    return new Date((v as { seconds: number }).seconds * 1000);
  }
  return new Date();
};

const generateToken = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

const mapInvite = (id: string, practiceId: string, d: Record<string, any>): PracticeInvite => ({
  id,
  practiceId,
  practiceName: String(d.practiceName ?? ''),
  email: String(d.email ?? '').toLowerCase(),
  displayName: d.displayName,
  role: d.role as PracticeRole,
  permissions: normalizePermissions(d.permissions, d.role as PracticeRole),
  invitedBy: String(d.invitedBy ?? ''),
  invitedByName: d.invitedByName,
  status: d.status,
  token: String(d.token ?? ''),
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
  acceptedAt: d.acceptedAt ? toDate(d.acceptedAt) : undefined,
  acceptedByUid: d.acceptedByUid,
});

const mapDjangoInvite = (row: {
  id: string;
  practiceId: string;
  practiceName: string;
  email: string;
  displayName?: string;
  role: string;
  permissions: Record<string, unknown>;
  invitedBy: string;
  invitedByName?: string;
  status: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
}): PracticeInvite =>
  mapInvite(row.id, row.practiceId, {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt) : undefined,
  });

export type CreatePracticeInviteInput = {
  practiceId: string;
  practiceName: string;
  email: string;
  displayName?: string;
  role: PracticeRole;
  permissions?: PracticePermissions;
  invitedBy: string;
  invitedByName?: string;
  phone?: string;
  hpcsaRegistrationNumber?: string;
};

/** Create a practice invite via Django API (or stub when Django is not configured). */
export const createPracticeInvite = async (
  input: CreatePracticeInviteInput,
): Promise<PracticeInvite> => {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Email is required');
  if (input.role === 'owner') throw new Error('Cannot invite another owner');

  if (isDjangoApiEnabled()) {
    const row = await djangoCreatePracticeInvite(input.practiceId, {
      email,
      displayName: input.displayName,
      role: input.role,
      permissions: input.permissions ?? permissionsForRole(input.role),
      invitedByName: input.invitedByName,
    });
    return mapDjangoInvite(row);
  }

  const token = generateToken();
  const invite: PracticeInvite = {
    id: `invite-${Date.now()}`,
    practiceId: input.practiceId,
    practiceName: input.practiceName,
    email,
    displayName: input.displayName ?? undefined,
    role: input.role,
    permissions: input.permissions ?? permissionsForRole(input.role),
    invitedBy: input.invitedBy,
    invitedByName: input.invitedByName ?? undefined,
    status: 'pending',
    token,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // TODO: persist invite + send email via Django endpoints once available.
  console.log(
    '[practiceInviteService] createPracticeInvite stub — email=' + email,
  );
  return invite;
};

export const listPracticeInvites = async (
  practiceId: string,
  status: PracticeInvite['status'] = 'pending',
): Promise<PracticeInvite[]> => {
  if (isDjangoApiEnabled()) {
    const rows = await djangoListPracticeInvites(practiceId, status);
    return rows.map(mapDjangoInvite);
  }

  // Firestore path removed.
  return [];
};

export const notifyPendingInvitesClinicLive = async (
  practiceId: string,
  practiceName: string,
): Promise<number> => {
  if (isDjangoApiEnabled()) {
    return djangoNotifyClinicLiveInvites(practiceId);
  }

  // Firestore path removed.
  const pending = await listPracticeInvites(practiceId, 'pending');
  for (const invite of pending) {
    console.log(
      '[practiceInviteService] notifyPendingInvitesClinicLive stub — ' +
        invite.email,
    );
  }
  return pending.length;
};

export const getPracticeInvite = async (
  practiceId: string,
  inviteId: string,
): Promise<PracticeInvite | null> => {
  if (isDjangoApiEnabled()) {
    const row = await djangoGetPracticeInvite(practiceId, inviteId);
    return row ? mapDjangoInvite(row) : null;
  }

  // Firestore path removed.
  return null;
};

export const revokePracticeInvite = async (
  practiceId: string,
  inviteId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoRevokePracticeInvite(practiceId, inviteId);
    return;
  }

  // Firestore path removed.
  console.log(
    '[practiceInviteService] revokePracticeInvite stub — inviteId=' + inviteId,
  );
};

export const resendPracticeInvite = async (
  practiceId: string,
  inviteId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoResendPracticeInvite(practiceId, inviteId);
    return;
  }

  const invite = await getPracticeInvite(practiceId, inviteId);
  if (!invite) throw new Error('Invitation not found');
  if (invite.status !== 'pending') throw new Error('Only pending invitations can be resent');

  // Firestore path removed.
  console.log(
    '[practiceInviteService] resendPracticeInvite stub — inviteId=' + inviteId,
  );
};

export const acceptPracticeInvite = async (params: {
  practiceId: string;
  inviteId: string;
  token: string;
  uid: string;
  email: string;
  displayName?: string;
}): Promise<PracticeMember> => {
  if (isDjangoApiEnabled()) {
    const member = await djangoAcceptPracticeInvite({
      practiceId: params.practiceId,
      inviteId: params.inviteId,
      token: params.token,
    });
    return {
      uid: String(member.uid ?? params.uid),
      practiceId: String(member.practiceId ?? params.practiceId),
      role: member.role as PracticeRole,
      permissions: normalizePermissions(
        member.permissions as PracticePermissions,
        member.role as PracticeRole,
      ),
      status: (member.status as PracticeMember['status']) ?? 'active',
      displayName: (member.displayName as string) || params.displayName,
      email: String(member.email ?? params.email).toLowerCase(),
      isClinician: Boolean(member.isClinician),
      invitedBy: String(member.invitedBy ?? ''),
      invitedAt: member.invitedAt ? new Date(String(member.invitedAt)) : new Date(),
      createdAt: member.createdAt ? new Date(String(member.createdAt)) : new Date(),
      updatedAt: member.updatedAt ? new Date(String(member.updatedAt)) : new Date(),
    };
  }

  const fallbackRole: PracticeRole = 'receptionist';
  return {
    uid: params.uid,
    practiceId: params.practiceId,
    role: fallbackRole,
    permissions: permissionsForRole(fallbackRole),
    status: 'active',
    displayName: params.displayName || undefined,
    email: params.email.toLowerCase(),
    isClinician: isClinicianRole(fallbackRole),
    invitedBy: '',
    invitedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};
