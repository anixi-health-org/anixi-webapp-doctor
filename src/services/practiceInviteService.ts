import { normalizePermissions, permissionsForRole } from '../lib/practiceRoles';
import {
  djangoAcceptPracticeInvite,
  djangoCreatePracticeInvite,
  djangoGetPracticeInvite,
  djangoPreviewPracticeInvite,
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

/** Create a practice invite. Requires the Anixi API. */
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

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
};

export const listPracticeInvites = async (
  practiceId: string,
  status: PracticeInvite['status'] = 'pending',
): Promise<PracticeInvite[]> => {
  if (isDjangoApiEnabled()) {
    const rows = await djangoListPracticeInvites(practiceId, status);
    return rows.map(mapDjangoInvite);
  }

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
};

export const notifyPendingInvitesClinicLive = async (
  practiceId: string,
  _practiceName?: string,
): Promise<number> => {
  if (isDjangoApiEnabled()) {
    return djangoNotifyClinicLiveInvites(practiceId);
  }

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
};

export const getPracticeInvite = async (
  practiceId: string,
  inviteId: string,
  token?: string,
): Promise<PracticeInvite | null> => {
  if (isDjangoApiEnabled()) {
    const row = token
      ? await djangoPreviewPracticeInvite(practiceId, inviteId, token)
      : await djangoGetPracticeInvite(practiceId, inviteId);
    return row ? mapDjangoInvite({ ...row, token: row.token || token || '' }) : null;
  }

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
};

export const revokePracticeInvite = async (
  practiceId: string,
  inviteId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoRevokePracticeInvite(practiceId, inviteId);
    return;
  }

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
};

export const resendPracticeInvite = async (
  practiceId: string,
  inviteId: string,
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoResendPracticeInvite(practiceId, inviteId);
    return;
  }

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
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

  throw new Error('Clinic invites require the Anixi API. Set REACT_APP_ANIXI_API_URL.');
};
