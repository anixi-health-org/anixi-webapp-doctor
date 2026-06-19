import React, { useMemo, useState } from 'react';
import { DelegatePermissions } from '../../types/permissions';
import {
  useDeactivateDelegate,
  useInviteDelegate,
  usePracticePermissions,
} from '../../hooks/usePracticePermissions';
import { getActiveDelegates } from '../../services/permissions/practicePermissionsService';

interface Props {
  doctorId: string;
  doctorName: string;
  isOwner: boolean;
}

const BUTTON_BRAND = '#516059';
const BUTTON_BRAND_DARK = '#45524D';

const DEFAULT_PERMISSIONS: DelegatePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
};

export const PracticePermissionsPanel: React.FC<Props> = ({
  doctorId,
  doctorName,
  isOwner,
}) => {
  const { data: permissions, isLoading, error: loadError, refetch } = usePracticePermissions(
    isOwner ? doctorId : undefined
  );
  const inviteMutation = useInviteDelegate(doctorId, doctorName);
  const deactivateMutation = useDeactivateDelegate(doctorId);

  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    permissions: DEFAULT_PERMISSIONS,
  });

  const delegates = useMemo(
    () => (permissions ? getActiveDelegates(permissions) : []),
    [permissions]
  );

  const onTogglePermission = (key: keyof DelegatePermissions) => {
    setInviteForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  const onInvite = async () => {
    if (!isOwner) return;
    if (!inviteForm.email.trim()) {
      setError('Email is required.');
      return;
    }

    setError(null);
    try {
      await inviteMutation.mutateAsync({
        email: inviteForm.email.trim(),
        displayName: inviteForm.displayName.trim() || undefined,
        permissions: inviteForm.permissions,
      });
      setInviteForm({ email: '', displayName: '', permissions: DEFAULT_PERMISSIONS });
      setShowInvite(false);
      setSuccess('Invitation sent by email. The delegate can accept via the link.');
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to invite delegate.');
    }
  };

  const onRemove = async (delegateId: string) => {
    if (!isOwner) return;
    if (!window.confirm('Remove this delegate from your practice?')) return;
    setError(null);
    try {
      await deactivateMutation.mutateAsync(delegateId);
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove delegate.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 bg-white">
        <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Practice Permissions</h3>
        <p className="mt-3 text-gray-600 max-w-2xl">
          Invite staff by email. They will receive a link to accept and get access to your practice.
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
              {showInvite ? 'Close Invite' : '+ Invite by Email'}
            </button>
          )}
        </div>

        {showInvite && isOwner && (
          <div className="mb-4 rounded-xl border border-[#E1D7BC] bg-[#FBF8EF] p-4 space-y-3">
            <p className="text-xs text-gray-600">
              Enter the delegate&apos;s email. They will receive an invitation link to accept access.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email address"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#B7A06A]"
              />
              <input
                value={inviteForm.displayName}
                onChange={(e) =>
                  setInviteForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="Display name (optional)"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#B7A06A]"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'manageAppointments', label: 'Manage Appointments' },
                    { key: 'manageSoftBlocks', label: 'Manage Soft Blocks' },
                    { key: 'overrideConflicts', label: 'Override Conflicts' },
                    { key: 'editBookingPolicies', label: 'Edit Booking Policies' },
                  ] as const
                ).map((p) => {
                  const enabled = inviteForm.permissions[p.key];
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => onTogglePermission(p.key)}
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
              disabled={inviteMutation.isPending}
              className="px-4 py-2.5 text-sm rounded-lg text-white bg-[#516059] hover:bg-[#45524D] disabled:opacity-50 w-full sm:w-auto"
            >
              {inviteMutation.isPending ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        )}

        {(error || loadError) && (
          <p className="mb-3 text-sm text-red-600">
            {error || (loadError instanceof Error ? loadError.message : 'Failed to load permissions')}
          </p>
        )}
        {success && <p className="mb-3 text-sm text-green-700">{success}</p>}

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading delegates…</p>
        ) : delegates.length === 0 ? (
          <p className="text-sm text-gray-500">No delegates added yet.</p>
        ) : (
          <div className="space-y-3">
            {delegates.map((d) => {
              const name = d.displayName?.trim() || d.email;
              const initial = name.charAt(0).toUpperCase();
              const statusLabel =
                d.status === 'pending' ? 'Pending' : d.status === 'active' ? 'Active' : 'Inactive';
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-gray-100 text-gray-700 text-sm flex items-center justify-center font-semibold">
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{d.email}</p>
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
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs border ${
                        d.status === 'pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : d.status === 'active'
                            ? 'bg-[#FBF8EF] text-[#7F6A3C] border-[#E1D7BC]'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      {statusLabel}
                    </span>
                    {isOwner && d.status !== 'inactive' && (
                      <button
                        onClick={() => onRemove(d.id)}
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
    </div>
  );
};
