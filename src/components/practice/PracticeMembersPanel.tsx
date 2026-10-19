import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClinicFormModal } from '../clinic/ClinicFormModal';
import { clinicButtonClasses } from '../clinic/clinicButtonStyles';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  formatRoleList,
  isClinicianRole,
  normalizeMemberRoles,
  permissionsForRoles,
} from '../../lib/practiceRoles';
import { PracticeRoleMultiSelect } from './PracticeRoleMultiSelect';
import { ListRowsSkeleton, PageLoadingState } from '../ui/Skeleton';
import {
  createPracticeInvite,
  listPracticeInvites,
  resendPracticeInvite,
  revokePracticeInvite,
  updatePracticeInvite,
} from '../../services/practiceInviteService';
import { logClinicAuditEvent } from '../../services/clinicAuditService';
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
   * full, header + invite + list (solo/practice settings)
   * clinic, invite + list without duplicate marketing header (clinic team page)
   * listOnly, members/invites only
   */
  variant?: 'full' | 'clinic' | 'listOnly';
  /** Bump to force reload after bulk invite */
  reloadToken?: number;
  extraHeaderActions?: React.ReactNode;
  onLoaded?: (info: { memberCount: number; inviteCount: number }) => void;
};

export const PracticeMembersPanel: React.FC<PracticeMembersPanelProps> = ({
  variant = 'full',
  reloadToken = 0,
  extraHeaderActions,
  onLoaded,
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
    roles: ['doctor'] as PracticeRole[],
  });
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [roleEditor, setRoleEditor] = useState<{
    uid: string;
    name: string;
    roles: PracticeRole[];
  } | null>(null);
  const [inviteEditor, setInviteEditor] = useState<{
    id: string;
    email: string;
    displayName: string;
    roles: PracticeRole[];
  } | null>(null);
  const onLoadedRef = React.useRef(onLoaded);
  onLoadedRef.current = onLoaded;

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
      onLoadedRef.current?.({ memberCount: m.length, inviteCount: i.length });
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
      const roles = normalizeMemberRoles('doctor', inviteForm.roles);
      await createPracticeInvite({
        practiceId: practice.id,
        practiceName: practice.name,
        email: inviteForm.email.trim(),
        displayName: inviteForm.displayName.trim() || undefined,
        role: roles[0],
        roles,
        permissions: permissionsForRoles(roles),
        invitedBy: user.id,
        invitedByName: user.displayName,
      });
      setInviteForm({ email: '', displayName: '', roles: ['doctor'] });
      setShowInvite(false);
      setSuccess(
        'Invitation emailed from info@anixihealth.com. They create a password via Accept invite.',
      );
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

  const onChangeRoles = async (uid: string, roles: PracticeRole[]) => {
    if (uid === practice.ownerId) return;
    const member = members.find((m) => m.uid === uid);
    const normalized = normalizeMemberRoles('doctor', roles);
    await updatePracticeMember(practice.id, uid, {
      roles: normalized,
      permissions: permissionsForRoles(normalized),
    });
    if (user?.id) {
      await logClinicAuditEvent({
        practiceId: practice.id,
        action: 'member.role_changed',
        actorUid: user.id,
        actorName: user.displayName,
        targetType: 'member',
        targetId: uid,
        summary: `Changed ${member?.displayName ?? member?.email ?? uid} to ${formatRoleList(normalized)}`,
        metadata: {
          previousRoles: member?.roles ?? [member?.role ?? 'delegate'],
          nextRoles: normalized,
        },
      });
    }
    await reload();
  };

  const saveRoleEditor = async () => {
    if (!roleEditor) return;
    setSaving(true);
    setError(null);
    try {
      await onChangeRoles(roleEditor.uid, roleEditor.roles);
      setRoleEditor(null);
      setSuccess('Roles updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roles');
    } finally {
      setSaving(false);
    }
  };

  const saveInviteEditor = async () => {
    if (!inviteEditor || !inviteEditor.email.trim()) {
      setError('Email is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const roles = normalizeMemberRoles('doctor', inviteEditor.roles);
      await updatePracticeInvite(practice.id, inviteEditor.id, {
        email: inviteEditor.email,
        displayName: inviteEditor.displayName,
        roles,
        permissions: permissionsForRoles(roles),
      });
      setInviteEditor(null);
      setSuccess('Invitation updated.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invitation');
    } finally {
      setSaving(false);
    }
  };

  const inviteFieldClass =
    'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20';

  const showInviteUi = variant !== 'listOnly';

  return (
    <div className="space-y-6">
      {variant === 'full' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Team</h3>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                Invite staff by role. Core roles: Administrator, Practice Manager, Doctor,
                Clinical Associate, Receptionist, and Content Creator. They join with one link —
                no separate clinic setup.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className={clinicButtonClasses('primary')}
            >
              Invite member
            </button>
          </div>
        </div>
      )}

      {variant === 'clinic' && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#344256]">Current team</h2>
            <p className="mt-1 text-sm text-[#65758b]">
              Active members and pending invitations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {extraHeaderActions}
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className={clinicButtonClasses('primary')}
            >
              Invite one person
            </button>
          </div>
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
              <PracticeRoleMultiSelect
                mode="invite"
                value={inviteForm.roles}
                onChange={(roles) => setInviteForm((f) => ({ ...f, roles }))}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onInvite()}
              className={clinicButtonClasses('primary')}
            >
              {saving ? 'Sending…' : 'Send invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className={clinicButtonClasses('outline')}
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
          {loading && members.length === 0 ? (
            <li className="p-4">
              <PageLoadingState label="Loading team members">
                <ListRowsSkeleton rows={5} />
              </PageLoadingState>
            </li>
          ) : null}
          {members.map((m) => {
            const label = memberDisplayLabel(m, practice.ownerId);
            return (
              <li
                key={m.uid}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {variant === 'clinic' ? (
                      <Link to={`/clinic/team/${m.uid}`} className="hover:text-anixi-green hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {m.uid === practice.ownerId ? (
                    <span
                      className={clinicButtonClasses('outline', 'sm', 'pointer-events-none opacity-90')}
                    >
                      {formatRoleList(normalizeMemberRoles(m.role, m.roles))}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setRoleEditor({
                            uid: m.uid,
                            name: label,
                            roles: normalizeMemberRoles(m.role, m.roles),
                          })
                        }
                        className={clinicButtonClasses('outline', 'sm')}
                      >
                        {formatRoleList(normalizeMemberRoles(m.role, m.roles))}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRemoveMember(m.uid)}
                        className={clinicButtonClasses('dangerOutline', 'sm')}
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {variant === 'clinic' ? (
                    <>
                      {normalizeMemberRoles(m.role, m.roles).some(isClinicianRole) &&
                      m.isClinician !== false ? (
                        <Link
                          to={`/clinic/team/${m.uid}#booking-schedule`}
                          className={clinicButtonClasses('secondary', 'sm')}
                        >
                          Schedule
                        </Link>
                      ) : null}
                      <Link
                        to={`/clinic/team/${m.uid}`}
                        className={clinicButtonClasses('primary', 'sm')}
                      >
                        Manage
                      </Link>
                    </>
                  ) : null}
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
                  <p className="font-medium text-gray-900">
                    {inv.displayName?.trim() || inv.email}
                  </p>
                  {inv.displayName?.trim() ? (
                    <p className="text-sm text-gray-500">{inv.email}</p>
                  ) : null}
                  <p className="text-sm text-gray-500">
                    {formatRoleList(normalizeMemberRoles(inv.role, inv.roles))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setInviteEditor({
                        id: inv.id,
                        email: inv.email,
                        displayName: inv.displayName?.trim() || '',
                        roles: normalizeMemberRoles(inv.role, inv.roles),
                      })
                    }
                    className={clinicButtonClasses('outline', 'sm')}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={resendingId === inv.id}
                    onClick={() => void onResend(inv.id)}
                    className={clinicButtonClasses('secondary', 'sm')}
                  >
                    {resendingId === inv.id ? 'Sending…' : 'Resend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRevoke(inv.id)}
                    className={clinicButtonClasses('dangerOutline', 'sm')}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ClinicFormModal
        open={roleEditor != null}
        title="Change roles"
        description={
          roleEditor ? `Update roles for ${roleEditor.name}. Changes apply immediately.` : undefined
        }
        onClose={() => setRoleEditor(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRoleEditor(null)}
              className={clinicButtonClasses('outline')}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveRoleEditor()}
              className={clinicButtonClasses('primary')}
              disabled={saving || !roleEditor}
            >
              {saving ? 'Saving…' : 'Save roles'}
            </button>
          </>
        }
      >
        {roleEditor ? (
          <PracticeRoleMultiSelect
            mode="member"
            value={roleEditor.roles}
            onChange={(roles) =>
              setRoleEditor((current) => (current ? { ...current, roles } : current))
            }
          />
        ) : null}
      </ClinicFormModal>

      <ClinicFormModal
        open={inviteEditor != null}
        title="Edit pending invite"
        description="Update details before they accept. The invite link stays the same."
        onClose={() => setInviteEditor(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setInviteEditor(null)}
              className={clinicButtonClasses('outline')}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveInviteEditor()}
              className={clinicButtonClasses('primary')}
              disabled={saving || !inviteEditor}
            >
              {saving ? 'Saving…' : 'Save invite'}
            </button>
          </>
        }
      >
        {inviteEditor ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                className={inviteFieldClass}
                value={inviteEditor.email}
                onChange={(e) =>
                  setInviteEditor((current) =>
                    current ? { ...current, email: e.target.value } : current,
                  )
                }
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Name (optional)
              <input
                className={inviteFieldClass}
                value={inviteEditor.displayName}
                onChange={(e) =>
                  setInviteEditor((current) =>
                    current ? { ...current, displayName: e.target.value } : current,
                  )
                }
              />
            </label>
            <PracticeRoleMultiSelect
              mode="invite"
              value={inviteEditor.roles}
              onChange={(roles) =>
                setInviteEditor((current) => (current ? { ...current, roles } : current))
              }
            />
          </div>
        ) : null}
      </ClinicFormModal>
    </div>
  );
};

export default PracticeMembersPanel;
