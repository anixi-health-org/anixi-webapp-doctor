import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  PRACTICES_COLLECTION,
  PRACTICE_INVITES_SUBCOLLECTION,
  PRACTICE_MEMBERS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '../shared/constants';
import { isClinicianRole, normalizePermissions, permissionsForRole } from '../lib/practiceRoles';
import { queueClinicLiveStaffReminderEmail } from './onboardingEmailService';
import type { PracticeInvite, PracticeMember, PracticePermissions, PracticeRole } from '../types';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : new Date(String(v));

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

/** Create a practice invite and enqueue an email with accept link. */
export const createPracticeInvite = async (
  input: CreatePracticeInviteInput
): Promise<PracticeInvite> => {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Email is required');
  if (input.role === 'owner') throw new Error('Cannot invite another owner');

  const permissions = input.permissions ?? permissionsForRole(input.role);
  const token = generateToken();

  const ref = await addDoc(
    collection(db, PRACTICES_COLLECTION, input.practiceId, PRACTICE_INVITES_SUBCOLLECTION),
    {
      practiceId: input.practiceId,
      practiceName: input.practiceName,
      email,
      displayName: input.displayName?.trim() || null,
      role: input.role,
      permissions,
      phone: input.phone?.trim() || null,
      hpcsaRegistrationNumber: input.hpcsaRegistrationNumber?.trim() || null,
      invitedBy: input.invitedBy,
      invitedByName: input.invitedByName || null,
      status: 'pending',
      token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const acceptUrl = `${origin}/join/invite?practiceId=${encodeURIComponent(
    input.practiceId
  )}&inviteId=${encodeURIComponent(ref.id)}&token=${encodeURIComponent(token)}`;

  try {
    await addDoc(collection(db, 'mail'), {
      to: [email],
      message: {
        subject: `You're invited to join ${input.practiceName} on Anixi Health`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #344256;">
            <p>Hello${input.displayName ? ` ${input.displayName}` : ''},</p>
            <p><strong>${input.invitedByName || 'Your clinic'}</strong> added you to
            <strong>${input.practiceName}</strong> on Anixi Health as
            <strong>${input.role.replace(/_/g, ' ')}</strong>.</p>
            <p><a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1a4d4d;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Accept invitation</a></p>
            <p><strong>What happens next</strong></p>
            <ol>
              <li>Accept the invitation and create your password</li>
              ${
                input.role === 'doctor'
                  ? '<li>Complete your professional (HPCSA) profile for clinical access</li><li>Sign in to your doctor portal once approved</li>'
                  : '<li>Sign in to the clinic admin portal to manage schedules and patients</li>'
              }
            </ol>
            <p>If the button does not work, copy this link:<br/><a href="${acceptUrl}">${acceptUrl}</a></p>
            <p>— The Anixi Health team</p>
          </div>
        `,
        text: `You're invited to join ${input.practiceName} on Anixi Health as ${input.role}. Accept: ${acceptUrl}. Then complete your profile and sign in.`,
      },
      meta: {
        type: 'practice_staff_invite',
        practiceId: input.practiceId,
        role: input.role,
      },
    });
  } catch (err) {
    console.warn('[practiceInvite] email enqueue failed (invite still created):', err);
  }

  const snap = await getDoc(ref);
  return mapInvite(ref.id, input.practiceId, snap.data() || {});
};

export const listPracticeInvites = async (
  practiceId: string,
  status: PracticeInvite['status'] = 'pending'
): Promise<PracticeInvite[]> => {
  const q = query(
    collection(db, PRACTICES_COLLECTION, practiceId, PRACTICE_INVITES_SUBCOLLECTION),
    where('status', '==', status)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapInvite(d.id, practiceId, d.data()));
};

/** Remind pending staff that clinic setup is complete (re-sends accept links). */
export const notifyPendingInvitesClinicLive = async (
  practiceId: string,
  practiceName: string
): Promise<number> => {
  const pending = await listPracticeInvites(practiceId, 'pending');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let sent = 0;

  for (const invite of pending) {
    const acceptUrl = `${origin}/join/invite?practiceId=${encodeURIComponent(
      practiceId
    )}&inviteId=${encodeURIComponent(invite.id)}&token=${encodeURIComponent(invite.token)}`;

    await queueClinicLiveStaffReminderEmail({
      to: invite.email,
      displayName: invite.displayName,
      practiceName,
      acceptUrl,
      role: invite.role,
    });
    sent += 1;
  }

  return sent;
};

export const getPracticeInvite = async (
  practiceId: string,
  inviteId: string
): Promise<PracticeInvite | null> => {
  const snap = await getDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_INVITES_SUBCOLLECTION, inviteId)
  );
  if (!snap.exists()) return null;
  return mapInvite(snap.id, practiceId, snap.data());
};

export const revokePracticeInvite = async (
  practiceId: string,
  inviteId: string
): Promise<void> => {
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_INVITES_SUBCOLLECTION, inviteId),
    { status: 'revoked', updatedAt: serverTimestamp() }
  );
};

/** Re-send a pending invite email with the existing accept link. */
export const resendPracticeInvite = async (
  practiceId: string,
  inviteId: string
): Promise<void> => {
  const invite = await getPracticeInvite(practiceId, inviteId);
  if (!invite) throw new Error('Invitation not found');
  if (invite.status !== 'pending') throw new Error('Only pending invitations can be resent');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const acceptUrl = `${origin}/join/invite?practiceId=${encodeURIComponent(
    practiceId
  )}&inviteId=${encodeURIComponent(invite.id)}&token=${encodeURIComponent(invite.token)}`;

  await addDoc(collection(db, 'mail'), {
    to: [invite.email],
    message: {
      subject: `Reminder: join ${invite.practiceName} on Anixi Health`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #344256;">
          <p>Hello${invite.displayName ? ` ${invite.displayName}` : ''},</p>
          <p>This is a reminder to accept your invitation to
          <strong>${invite.practiceName}</strong> as
          <strong>${invite.role.replace(/_/g, ' ')}</strong>.</p>
          <p><a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1a4d4d;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Accept invitation</a></p>
          <p>If the button does not work, copy this link:<br/><a href="${acceptUrl}">${acceptUrl}</a></p>
          <p>— The Anixi Health team</p>
        </div>
      `,
      text: `Reminder: join ${invite.practiceName}. Accept: ${acceptUrl}`,
    },
    meta: {
      type: 'practice_staff_invite_resend',
      practiceId,
      role: invite.role,
    },
  });

  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_INVITES_SUBCOLLECTION, inviteId),
    { updatedAt: serverTimestamp() }
  );
};

/**
 * Accept an invite: activate membership, link primaryPracticeId, mark invite accepted.
 * Caller must already be authenticated as the accepting user.
 */
export const acceptPracticeInvite = async (params: {
  practiceId: string;
  inviteId: string;
  token: string;
  uid: string;
  email: string;
  displayName?: string;
}): Promise<PracticeMember> => {
  const invite = await getPracticeInvite(params.practiceId, params.inviteId);
  if (!invite) throw new Error('Invitation not found');
  if (invite.status !== 'pending') throw new Error('This invitation is no longer valid');
  if (invite.token !== params.token) throw new Error('Invalid invitation link');
  if (invite.email.toLowerCase() !== params.email.trim().toLowerCase()) {
    throw new Error('Sign in with the email address this invitation was sent to');
  }

  const memberRef = doc(
    db,
    PRACTICES_COLLECTION,
    params.practiceId,
    PRACTICE_MEMBERS_SUBCOLLECTION,
    params.uid
  );

  const memberPayload = {
    uid: params.uid,
    practiceId: params.practiceId,
    role: invite.role,
    permissions: invite.permissions,
    status: 'active' as const,
    displayName: params.displayName || invite.displayName || null,
    email: params.email.toLowerCase(),
    isClinician: isClinicianRole(invite.role),
    invitedBy: invite.invitedBy,
    invitedAt: invite.createdAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(memberRef, memberPayload, { merge: true });

  await setDoc(
    doc(db, USERS_COLLECTION, params.uid),
    {
      primaryPracticeId: params.practiceId,
      practiceRole: invite.role,
      // Invitees join a live clinic — they do not run the owner setup wizard.
      clinicOnboardingComplete: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await updateDoc(
    doc(db, PRACTICES_COLLECTION, params.practiceId, PRACTICE_INVITES_SUBCOLLECTION, params.inviteId),
    {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedByUid: params.uid,
      updatedAt: serverTimestamp(),
    }
  );

  return {
    uid: params.uid,
    practiceId: params.practiceId,
    role: invite.role,
    permissions: invite.permissions,
    status: 'active',
    displayName: params.displayName || invite.displayName,
    email: params.email.toLowerCase(),
    isClinician: isClinicianRole(invite.role),
    invitedBy: invite.invitedBy,
    invitedAt: invite.createdAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};
