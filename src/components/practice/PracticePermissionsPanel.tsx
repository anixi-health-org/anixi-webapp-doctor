import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDelegate,
  listPracticeMembers,
  removeDelegate,
} from '../../services/practiceSettingsService';
import { PracticeMember, PracticePermissions } from '../../types';

interface Props {
  practiceId: string;
  isOwner: boolean;
}

const BUTTON_BRAND = '#516059';
const BUTTON_BRAND_DARK = '#45524D';

const DEFAULT_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
};

export const PracticePermissionsPanel: React.FC<Props> = ({ practiceId, isOwner }) => {
  const [members, setMembers] = useState<PracticeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    uid: '',
    displayName: '',
    email: '',
    permissions: DEFAULT_PERMISSIONS,
  });

  const delegates = useMemo(
    () => members.filter((m) => m.role === 'delegate'),
    [members]
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPracticeMembers(practiceId);
      setMembers(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load practice members.');
    } finally {
      setLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const onTogglePermission = (key: keyof PracticePermissions) => {
    setInviteForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const onInvite = async () => {
    if (!isOwner) return;
    if (!inviteForm.uid.trim() || !inviteForm.email.trim()) {
      setError('Delegate UID and email are required.');
      return;
    }

    setInviteSaving(true);
    setError(null);
    try {
      await addDelegate(
        practiceId,
        inviteForm.uid.trim(),
        inviteForm.displayName.trim() || 'Delegate',
        inviteForm.email.trim(),
        inviteForm.permissions
      );
      setInviteForm({
        uid: '',
        displayName: '',
        email: '',
        permissions: DEFAULT_PERMISSIONS,
      });
      setShowInvite(false);
      await loadMembers();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add delegate.');
    } finally {
      setInviteSaving(false);
    }
  };

  const onRemove = async (uid: string) => {
    if (!isOwner) return;
    if (!window.confirm('Remove this delegate from your practice?')) return;

    setError(null);
    try {
      await removeDelegate(practiceId, uid);
      await loadMembers();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to remove delegate.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 bg-white">
        <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Practice Permissions</h3>
        <p className="mt-3 text-gray-600 max-w-2xl">
          Manage who can access and modify your practice settings. As the owner, you have full
          control over all features.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h4 className="text-lg sm:text-xl font-semibold text-gray-900">Delegates</h4>
          {isOwner && (
            <button
              onClick={() => setShowInvite((prev) => !prev)}
              className="px-4 py-2.5 rounded-xl text-sm text-white transition-colors w-full sm:w-auto"
              style={{ backgroundColor: BUTTON_BRAND }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = BUTTON_BRAND_DARK;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = BUTTON_BRAND;
              }}
            >
              {showInvite ? 'Close Invite' : '+ Invite'}
            </button>
          )}
        </div>

        {showInvite && isOwner && (
          <div className="mb-4 rounded-xl border border-[#E1D7BC] bg-[#FBF8EF] p-4 space-y-3">
            <p className="text-xs text-gray-600">
              Invite by entering the delegate account UID and email.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                value={inviteForm.uid}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, uid: e.target.value }))}
                placeholder="Delegate UID"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#B7A06A]"
              />
              <input
                value={inviteForm.displayName}
                onChange={(e) =>
                  setInviteForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="Display name"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#B7A06A]"
              />
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#B7A06A]"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'manageAppointments', label: 'Manage Appointments' },
                  { key: 'manageSoftBlocks', label: 'Manage Soft Blocks' },
                  { key: 'overrideConflicts', label: 'Override Conflicts' },
                  { key: 'editBookingPolicies', label: 'Edit Booking Policies' },
                ].map((p) => {
                  const enabled = inviteForm.permissions[p.key as keyof PracticePermissions];
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => onTogglePermission(p.key as keyof PracticePermissions)}
                      className={`px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                        enabled
                          ? 'bg-[#B7A06A] text-white border-[#B7A06A]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[#B7A06A]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onInvite}
              disabled={inviteSaving}
              className="px-4 py-2.5 text-sm rounded-lg text-white bg-[#516059] hover:bg-[#45524D] disabled:opacity-50 w-full sm:w-auto"
            >
              {inviteSaving ? 'Inviting…' : 'Save Delegate'}
            </button>
          </div>
        )}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading delegates…</p>
        ) : delegates.length === 0 ? (
          <p className="text-sm text-gray-500">No delegates added yet.</p>
        ) : (
          <div className="space-y-3">
            {delegates.map((d) => {
              const name = d.displayName?.trim() || d.email || d.uid;
              const initial = name.charAt(0).toUpperCase();
              return (
                <div
                  key={d.uid}
                  className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-gray-100 text-gray-700 text-sm flex items-center justify-center font-semibold">
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{d.email || d.uid}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(d.permissions)
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => (
                          <span
                            key={key}
                            className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-[#EEF2F0] text-[#45524D]"
                          >
                            {key === 'manageAppointments' && 'Appointments'}
                            {key === 'manageSoftBlocks' && 'Soft Blocks'}
                            {key === 'overrideConflicts' && 'Override Conflicts'}
                            {key === 'editBookingPolicies' && 'Booking Policies'}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#FBF8EF] text-[#7F6A3C] border border-[#E1D7BC]">
                      Active
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => onRemove(d.uid)}
                        className="text-sm text-red-500 hover:text-red-700 px-2 py-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 bg-white">
        <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Permission Descriptions</h4>
        <div className="space-y-4">
          <div>
            <p className="text-lg font-medium text-gray-900">Manage Appointments</p>
            <p className="text-gray-600">View, approve, decline, and cancel patient appointments.</p>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">Manage Soft Blocks</p>
            <p className="text-gray-600">
              Create and edit soft blocks for surgery, rounds, admin time, and other blocked windows.
            </p>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">Override Conflicts</p>
            <p className="text-gray-600">
              Book appointments even when a soft-block conflict is detected.
            </p>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">Edit Booking Policies</p>
            <p className="text-gray-600">
              Update cancellation windows, confirmations, and no-show policy settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
