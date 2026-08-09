import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { usePracticeSettings } from '../hooks/usePracticeSettings';
import { BookableBlocksEditor } from '../components/practice/BookableBlocksEditor';
import { SoftBlocksEditor } from '../components/practice/SoftBlocksEditor';
import { BookingPoliciesForm } from '../components/practice/BookingPoliciesForm';
import { PracticePermissionsPanel } from '../components/practice/PracticePermissionsPanel';
import { PracticeMembersPanel } from '../components/practice/PracticeMembersPanel';
import { LetterheadSetupBanner } from '../components/invoices/LetterheadSetupBanner';
import { Toast, SettingsPageSkeleton, CardSkeleton } from '../components/ui';
import { TabPill } from '../components/ui/TabPill';
import { PageShell } from '../components/page-layout';
import { updatePractice, provisionPracticeForDoctor } from '../services/practiceSettingsService';
import type { ConsultType, Doctor, PracticeLocation } from '../types';

type Tab = 'overview' | 'availability' | 'soft-blocks' | 'policies' | 'permissions' | 'team';

const TAB_CONFIG: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'availability', label: 'Clinic Hours' },
  { id: 'soft-blocks', label: 'Blocked Time' },
  { id: 'policies', label: 'Booking Rules' },
  { id: 'team', label: 'Team' },
  { id: 'permissions', label: 'Delegates' },
];

const isValidTab = (value: string | null): value is Tab =>
  TAB_CONFIG.some((tab) => tab.id === value);

const CONSULT_TYPE_LABELS: Record<ConsultType, string> = {
  initial: 'Initial',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  procedure: 'Procedure',
  teleconsult: 'Virtual / video',
  other: 'Other',
};

const PracticeSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, practiceSession, refreshPracticeSession, isLoading: authLoading } = useAuth();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const { can, isOwner, role } = usePermissions();
  const { bookableBlocks, softBlocks, bookingPolicy, isLoading, error, reload } =
    usePracticeSettings();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<Tab>(
    isValidTab(tabParam) ? tabParam : 'overview'
  );

  useEffect(() => {
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<PracticeLocation['type']>('clinic');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  const [consultTypesDraft, setConsultTypesDraft] = useState<ConsultType[]>([]);
  const [savingConsultTypes, setSavingConsultTypes] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const [provisioning, setProvisioning] = useState(false);

  const practice = practiceSession?.practice;
  const member = practiceSession?.member;

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  useEffect(() => {
    if (practice) setConsultTypesDraft(practice.consultTypes ?? []);
  }, [practice]);

  const handleProvisionPractice = async () => {
    if (!user?.id) return;
    setProvisioning(true);
    try {
      await provisionPracticeForDoctor(user.id, {
        name:
          (doctor?.practiceName && doctor.practiceName.trim()) ||
          (user.displayName ? `${user.displayName}'s Practice` : 'My Practice'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      await refreshPracticeSession();
      setToast({ visible: true, message: 'Practice set up successfully.', type: 'success' });
    } catch (e: unknown) {
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Failed to set up practice.',
        type: 'error',
      });
    } finally {
      setProvisioning(false);
    }
  };

  if (authLoading) {
    return (
      <PageShell>
        <SettingsPageSkeleton />
      </PageShell>
    );
  }

  if (!practice) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">Set up your practice</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#65758b]">
          We couldn&apos;t load a practice for your account yet. This usually happens on first login.
          You can create your practice now.
        </p>
        <button
          type="button"
          onClick={() => void handleProvisionPractice()}
          disabled={provisioning || !user?.id}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-anixi-green px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f] disabled:opacity-50"
        >
          {provisioning ? 'Setting up…' : 'Create my practice'}
        </button>
        <button
          type="button"
          onClick={() => void refreshPracticeSession()}
          className="mt-3 text-[13px] font-medium text-anixi-green hover:underline"
        >
          Retry loading
        </button>
      </div>
    );
  }

  const handleAddLocation = async () => {
    if (!newLocName.trim()) return;
    setSavingLoc(true);
    try {
      const newLoc: PracticeLocation = {
        id: crypto.randomUUID(),
        name: newLocName.trim(),
        type: newLocType,
        ...(newLocAddress.trim() ? { address: newLocAddress.trim() } : {}),
      };
      await updatePractice(practice.id, { locations: [...practice.locations, newLoc] });
      await refreshPracticeSession();
      setNewLocName('');
      setNewLocType('clinic');
      setNewLocAddress('');
      setToast({ visible: true, message: 'Location added.', type: 'success' });
    } catch (e: unknown) {
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Failed to add location.',
        type: 'error',
      });
    } finally {
      setSavingLoc(false);
    }
  };

  const handleRemoveLocation = async (locId: string) => {
    try {
      await updatePractice(practice.id, {
        locations: practice.locations.filter((l) => l.id !== locId),
      });
      await refreshPracticeSession();
      setToast({ visible: true, message: 'Location removed.', type: 'success' });
    } catch (e: unknown) {
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Failed to remove location.',
        type: 'error',
      });
    }
  };

  const handleSaveConsultTypes = async () => {
    setSavingConsultTypes(true);
    try {
      await updatePractice(practice.id, { consultTypes: consultTypesDraft });
      await refreshPracticeSession();
      setToast({ visible: true, message: 'Consult types updated.', type: 'success' });
    } catch (e: unknown) {
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Failed to update consult types.',
        type: 'error',
      });
    } finally {
      setSavingConsultTypes(false);
    }
  };

  const permissionItems = [
    { key: 'manageAppointments' as const, label: 'Manage appointments' },
    { key: 'overrideConflicts' as const, label: 'Override conflicts' },
    { key: 'manageSoftBlocks' as const, label: 'Manage soft blocks' },
    { key: 'editBookingPolicies' as const, label: 'Edit booking policies' },
  ];

  return (
    <PageShell className="max-w-5xl pb-10">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">Practice settings</h1>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                isOwner ? 'bg-[#0E2340] text-white' : 'bg-[#f0f4f8] text-[#65758b]'
              }`}
            >
              {isOwner ? 'Owner' : 'Delegate'}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#65758b]">
            Manage availability, blocked time, branding, and booking rules.
          </p>
        </div>
      </div>

      {activeTab === 'overview' && (
        <LetterheadSetupBanner doctor={doctor} className="mb-5" />
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#e1e7ef] bg-[#f0f4f8] p-1">
        {TAB_CONFIG.map((tab) => (
          <TabPill
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            active={activeTab === tab.id}
            className={`min-w-0 flex-1 whitespace-nowrap px-3 py-2 text-center text-xs sm:text-[13px] ${
              activeTab === tab.id
                ? '!bg-white !text-[#0E2340] !shadow-sm'
                : '!bg-transparent !text-[#65758b] hover:!text-[#344256]'
            }`}
          >
            {tab.label}
          </TabPill>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <CardSkeleton rows={6} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
          <div className="p-5 sm:p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <section>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                    Practice identity
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                        Practice name
                      </label>
                      <p className="text-sm font-semibold text-[#0E2340]">{practice.name}</p>
                    </div>

                    <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                        Timezone
                      </label>
                      <p className="text-sm font-semibold text-[#0E2340]">{practice.timezone}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] text-[#65758b]">
                    Practice name and timezone are set during onboarding.{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/professional-profile')}
                      className="font-semibold text-anixi-green hover:underline"
                    >
                      Update in Professional Profile
                    </button>
                  </p>

                  <div className="mt-4 rounded-xl border border-[#e1e7ef] bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#0E2340]">Letterhead & logo</p>
                        <p className="mt-0.5 text-[13px] text-[#65758b]">
                          Used on invoices, prescriptions, and doctor letters.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/professional-profile')}
                        className="inline-flex h-9 items-center rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-3.5 text-xs font-semibold text-[#344256] shadow-sm transition hover:border-anixi-green hover:text-anixi-green"
                      >
                        {doctor?.logoUrl ? 'Update branding' : 'Upload logo'}
                      </button>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                    Your access level
                  </p>
                  <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
                    <p className="mb-3 text-sm font-semibold capitalize text-[#0E2340]">{role}</p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {permissionItems.map((p) => {
                        const enabled = Boolean(
                          member?.permissions[p.key as keyof typeof member.permissions]
                        );
                        return (
                          <div key={p.key} className="flex items-center gap-2.5">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                enabled ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                            <span className="text-[13px] text-[#344256]">{p.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                    Locations
                  </p>
                  <div className="space-y-2">
                    {practice.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#e1e7ef] px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef4f1] text-anixi-green">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0E2340]">{loc.name}</p>
                            <p className="text-xs capitalize text-[#65758b]">
                              {loc.type}
                              {loc.address ? ` · ${loc.address}` : ''}
                            </p>
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveLocation(loc.id)}
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {practice.locations.length === 0 && (
                      <p className="rounded-xl border border-dashed border-[#e1e7ef] px-4 py-6 text-center text-[13px] text-[#94a3b8]">
                        No locations added yet.
                      </p>
                    )}
                  </div>

                  {isOwner && (
                    <div className="mt-3 rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
                      <p className="mb-3 text-sm font-semibold text-[#0E2340]">Add a location</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input
                          value={newLocName}
                          onChange={(e) => setNewLocName(e.target.value)}
                          placeholder="Location name"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={newLocType}
                          onChange={(e) => setNewLocType(e.target.value as PracticeLocation['type'])}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="clinic">Clinic</option>
                          <option value="hospital">Hospital</option>
                          <option value="virtual">Virtual</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          value={newLocAddress}
                          onChange={(e) => setNewLocAddress(e.target.value)}
                          placeholder="Address (optional)"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAddLocation()}
                        disabled={savingLoc || !newLocName.trim()}
                        className="mt-3 inline-flex h-9 items-center rounded-lg bg-anixi-green px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#365c4f] disabled:opacity-50"
                      >
                        {savingLoc ? 'Adding…' : 'Add location'}
                      </button>
                    </div>
                  )}
                </section>

                <section>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                    Consult types
                  </p>
                  <p className="mb-3 text-[13px] text-[#65758b]">
                    Toggle which consult types this practice offers.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CONSULT_TYPE_LABELS) as ConsultType[]).map((ct) => {
                      const active = consultTypesDraft.includes(ct);
                      return (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => {
                            if (!isOwner) return;
                            setConsultTypesDraft((prev) =>
                              active ? prev.filter((t) => t !== ct) : [...prev, ct]
                            );
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-anixi-green bg-anixi-green text-white'
                              : 'border-[#e1e7ef] bg-white text-[#65758b] hover:border-anixi-green/40 hover:text-anixi-green'
                          } ${!isOwner ? 'cursor-default' : ''}`}
                        >
                          {CONSULT_TYPE_LABELS[ct]}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'availability' &&
              (can('manageAppointments') ? (
                <BookableBlocksEditor
                  practiceId={practice.id}
                  blocks={bookableBlocks}
                  locations={practice.locations}
                  onChanged={reload}
                />
              ) : (
                <PermissionDenied message="You don't have permission to manage availability blocks." />
              ))}

            {activeTab === 'soft-blocks' &&
              (can('manageSoftBlocks') ? (
                <SoftBlocksEditor
                  practiceId={practice.id}
                  softBlocks={softBlocks}
                  onChanged={reload}
                />
              ) : (
                <PermissionDenied message="You don't have permission to manage soft blocks." />
              ))}

            {activeTab === 'policies' && bookingPolicy && (
              <BookingPoliciesForm
                practiceId={practice.id}
                policy={bookingPolicy}
                onSaved={reload}
                readOnly={!can('editBookingPolicies')}
              />
            )}

            {activeTab === 'team' && <PracticeMembersPanel />}

            {activeTab === 'permissions' && (
              <PracticePermissionsPanel
                doctorId={user?.id ?? practice.ownerId}
                doctorName={user?.displayName ?? practice.name}
                isOwner={isOwner}
              />
            )}
          </div>

          {activeTab === 'overview' && isOwner && (
            <div className="flex justify-end border-t border-[#e1e7ef] bg-[#f8fafc] px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => void handleSaveConsultTypes()}
                disabled={savingConsultTypes}
                className="inline-flex h-10 items-center rounded-lg bg-anixi-green px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f] disabled:opacity-50"
              >
                {savingConsultTypes ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
};

const PermissionDenied: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-40 flex-col items-center justify-center text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f4f8] text-[#8FA0B6]">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
    <p className="text-sm text-[#344256]">{message}</p>
    <p className="mt-1 text-xs text-[#94a3b8]">Contact the practice owner to request access.</p>
  </div>
);

export default PracticeSettingsPage;
