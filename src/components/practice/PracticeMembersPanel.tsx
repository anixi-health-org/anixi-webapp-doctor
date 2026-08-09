import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  INVITABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  permissionsForRole,
} from '../../lib/practiceRoles';
import {
  createPracticeInvite,
  listPracticeInvites,
  resendPracticeInvite,
  revokePracticeInvite,
} from '../../services/practiceInviteService';
import {
  deactivatePracticeMember,
  listPracticeMembers,
  updatePracticeMember,
} from '../../services/practiceSettingsService';
import {
  enrichPracticeMembers,
  memberDisplayLabel,
} from '../../services/practiceMemberService';
import type { PracticeInvite, PracticeMember, PracticeRole } from '../../types';

type PracticeMembersPanelProps = {
  /**
   * full — header + invite + list (solo/practice settings)
   * clinic — invite + list without duplicate marketing header (clinic team page)
   * listOnly — members/invites only
   */
  variant?: 'full' | 'clinic' | 'listOnly';
  /** Bump to force reload after bulk invite */
  reloadToken?: number;
};

export const PracticeMembersPanel: React.FC<PracticeMembersPanelProps> = ({
  variant = 'full',
  reloadToken = 0,
}) => {
  const { user, practiceSession } = useAuth();
  const { canManageMembers, isOwner } = usePermissions();
  const practice = practiceSession?.practice;

  const [members, setMembers] = useState<PracticeMember[]>([]);
  const [invites, setInvites] = useState<PracticeInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    role: 'doctor' as PracticeRole,
  });
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!practice?.id) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        enrichPracticeMembers(await listPracticeMembers(practice.id)),
        listPracticeInvites(practice.id, 'pending'),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [practice?.id]);

  useEffect(() => {
    void reload();
  }, [reload, reloadToken]);

  if (!practice) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        Create or join a practice to manage your team.
      </div>
    );
  }

  if (!canManageMembers && !isOwner) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        You don&apos;t have permission to manage team members.
      </div>
    );
  }

  const onInvite = async () => {
    if (!user || !inviteForm.email.trim()) {
      setError('Email is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPracticeInvite({
        practiceId: practice.id,
        practiceName: practice.name,
        email: inviteForm.email.trim(),
        displayName: inviteForm.displayName.trim() || undefined,
        role: inviteForm.role,
        permissions: permissionsForRole(inviteForm.role),
        invitedBy: user.id,
        invitedByName: user.displayName,
      });
      setInviteForm({ email: '', displayName: '', role: 'doctor' });
      setShowInvite(false);
      setSuccess('Invitation sent. They will get an email with a one-click join link.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (inviteId: string) => {
    if (!window.confirm('Revoke this invitation?')) return;
    await revokePracticeInvite(practice.id, inviteId);
    await reload();
  };

  const onResend = async (inviteId: string) => {
    setResendingId(inviteId);
    setError(null);
    try {
      await resendPracticeInvite(practice.id, inviteId);
      setSuccess('Invitation email resent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setResendingId(null);
    }
  };

  const onRemoveMember = async (uid: string) => {
    if (uid === practice.ownerId) {
      setError('Cannot remove the practice owner');
      return;
    }
    if (!window.confirm('Remove this member from the practice?')) return;
    await deactivatePracticeMember(practice.id, uid);
    await reload();
  };

  const onChangeRole = async (uid: string, role: PracticeRole) => {
    if (uid === practice.ownerId) return;
    await updatePracticeMember(practice.id, uid, {
      role,
      permissions: permissionsForRole(role),
    });
    await reload();
  };

  const showInviteUi = variant !== 'listOnly';

  return (
    <div className="space-y-6">
      {variant === 'full' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Team</h3>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                Invite doctors, receptionists, and practice managers. They join with one link - no
                separate clinic setup.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Invite member
            </button>
          </div>
        </div>
      )}

      {variant === 'clinic' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#344256]">Current team</h2>
            <p className="mt-1 text-sm text-[#65758b]">
              Active members and pending invitations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Invite one person
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      )}

      {showInviteUi && showInvite && (
        <div className="rounded-2xl border border-anixi-green/20 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-gray-900">New invitation</h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="colleague@clinic.co.za"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name (optional)</label>
              <input
                value={inviteForm.displayName}
                onChange={(e) => setInviteForm((f) => ({ ...f, displayName: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, role: e.target.value as PracticeRole }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]} - {ROLE_DESCRIPTIONS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onInvite()}
              className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Sending…' : 'Send invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">
          Active members {loading ? '' : `(${members.length})`}
        </div>
        <ul className="divide-y divide-gray-100">
          {members.map((m) => {
            const label = memberDisplayLabel(m, practice.ownerId);
            return (
              <li
                key={m.uid}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {label}
                    {m.uid === practice.ownerId && (
                      <span className="ml-2 rounded-full bg-[#eef4f1] px-2 py-0.5 text-xs text-anixi-green">
                        Owner
                      </span>
                    )}
                  </p>
                  {m.email && m.email.toLowerCase() !== label.toLowerCase() && (
                    <p className="text-sm text-gray-500">{m.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {m.uid === practice.ownerId ? (
                    <span className="text-sm text-gray-600">{ROLE_LABELS[m.role]}</span>
                  ) : (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => void onChangeRole(m.uid, e.target.value as PracticeRole)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      >
                        {(
                          [
                            'practice_manager',
                            'doctor',
                            'receptionist',
                            'billing_clerk',
                            'delegate',
                          ] as PracticeRole[]
                        ).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void onRemoveMember(m.uid)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {!loading && members.length === 0 && (
            <li className="px-5 py-6 text-sm text-gray-500">No members yet.</li>
          )}
        </ul>
      </div>

      {invites.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">
            Pending invites ({invites.length})
          </div>
          <ul className="divide-y divide-gray-100">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{inv.email}</p>
                  <p className="text-sm text-gray-500">{ROLE_LABELS[inv.role]}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={resendingId === inv.id}
                    onClick={() => void onResend(inv.id)}
                    className="text-sm font-medium text-anixi-green hover:underline disabled:opacity-50"
                  >
                    {resendingId === inv.id ? 'Sending…' : 'Resend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRevoke(inv.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PracticeMembersPanel;
