import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  CalendarOff,
  ClipboardList,
  MapPin,
  Shield,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { usePracticeSettings } from '../hooks/usePracticeSettings';
import { BookableBlocksEditor } from '../components/practice/BookableBlocksEditor';
import { ClinicManagedNotice } from '../components/practice/ClinicManagedNotice';
import { SoftBlocksEditor } from '../components/practice/SoftBlocksEditor';
import { BookingPoliciesForm } from '../components/practice/BookingPoliciesForm';
import { PracticePermissionsPanel } from '../components/practice/PracticePermissionsPanel';
import { PracticeMembersPanel } from '../components/practice/PracticeMembersPanel';
import { PracticeLogoUploader } from '../components/practice/PracticeLogoUploader';
import { LetterheadSetupBanner } from '../components/invoices/LetterheadSetupBanner';
import { Toast, SettingsPageSkeleton, CardSkeleton } from '../components/ui';
import { PageShell } from '../components/page-layout';
import { updatePractice, provisionPracticeForDoctor } from '../services/practiceSettingsService';
import {
  consultTypesFromVisitModes,
  practiceOffersClinicVisits,
  practiceOffersVideoConsults,
} from '../lib/consultTypeSettings';
import type { ConsultType, Doctor, PracticeLocation } from '../types';

type Tab = 'overview' | 'availability' | 'soft-blocks' | 'policies' | 'permissions' | 'team';

const TAB_CONFIG: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'availability', label: 'Availability', icon: CalendarClock },
  { id: 'soft-blocks', label: 'Blocked Time', icon: CalendarOff },
  { id: 'policies', label: 'Booking Rules', icon: ClipboardList },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'permissions', label: 'Delegates', icon: Shield },
];

const isValidTab = (value: string | null): value is Tab =>
  TAB_CONFIG.some((tab) => tab.id === value);

const LOCATION_TYPE_LABELS: Record<PracticeLocation['type'], string> = {
  clinic: 'Clinic',
  hospital: 'Clinic',
  virtual: 'Video',
  other: 'Other',
};

const PracticeSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, practiceSession, refreshPracticeSession, isLoading: authLoading } = useAuth();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const { can, isOwner, role, isClinicEmployedClinician } = usePermissions();
  const { bookableBlocks, softBlocks, bookingPolicy, isLoading, error, reload } =
    usePracticeSettings();
  const tabParam = searchParams.get('tab');
  const defaultTab: Tab = isClinicEmployedClinician ? 'availability' : 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(
    isValidTab(tabParam) ? tabParam : defaultTab
  );

  const visibleTabs = useMemo(() => {
    if (isClinicEmployedClinician) {
      return TAB_CONFIG.filter((tab) => tab.id === 'availability' || tab.id === 'policies');
    }
    return TAB_CONFIG;
  }, [isClinicEmployedClinician]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  useEffect(() => {
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      const next = visibleTabs[0]?.id ?? 'availability';
      setActiveTab(next);
      setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });
    }
  }, [visibleTabs, activeTab, setSearchParams]);

  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<PracticeLocation['type']>('clinic');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);
  const [savingVisitModes, setSavingVisitModes] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  const [consultTypesDraft, setConsultTypesDraft] = useState<ConsultType[]>([]);

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
      setAddingLocation(false);
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

  const offersClinic = practiceOffersClinicVisits(consultTypesDraft);
  const offersVideo = practiceOffersVideoConsults(consultTypesDraft);

  const handleSaveVisitModes = async (clinic: boolean, video: boolean) => {
    if (!clinic && !video) {
      setToast({
        visible: true,
        message: 'Keep at least one visit type so patients can book.',
        type: 'error',
      });
      return;
    }
    const next = consultTypesFromVisitModes(clinic, video);
    setSavingVisitModes(true);
    setConsultTypesDraft(next);
    try {
      await updatePractice(practice.id, { consultTypes: next });
      await refreshPracticeSession();
      setToast({ visible: true, message: 'Visit types updated.', type: 'success' });
    } catch (e: unknown) {
      setConsultTypesDraft(practice.consultTypes ?? []);
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Failed to update visit types.',
        type: 'error',
      });
    } finally {
      setSavingVisitModes(false);
    }
  };

  const permissionItems = [
    { key: 'manageAppointments' as const, label: 'Manage appointments' },
    { key: 'overrideConflicts' as const, label: 'Override conflicts' },
    { key: 'manageSoftBlocks' as const, label: 'Manage blocked time' },
    { key: 'editBookingPolicies' as const, label: 'Edit booking rules' },
  ];

  return (
    <PageShell className="max-w-5xl pb-12">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">
            {isClinicEmployedClinician ? 'My schedule' : 'Practice settings'}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isClinicEmployedClinician
                ? 'bg-[#eef4f1] text-[#427160]'
                : isOwner
                  ? 'bg-anixi-green text-white'
                  : 'bg-[#eef4f1] text-[#427160]'
            }`}
          >
            {isClinicEmployedClinician ? 'Clinic team' : isOwner ? 'Owner' : 'Delegate'}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-[#65758b]">
          {isClinicEmployedClinician
            ? 'View the hours and booking rules your clinic administrator has assigned to you.'
            : 'Hours, visit types, branding, and who can book with you.'}
        </p>
      </div>

      {isClinicEmployedClinician && (
        <ClinicManagedNotice practiceName={practice.name} className="mb-5" />
      )}

      {!isClinicEmployedClinician && activeTab === 'overview' && (
        <LetterheadSetupBanner doctor={doctor} className="mb-5" />
      )}

      <nav
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-[#e8f0ec] p-1.5"
        aria-label="Practice settings sections"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? 'bg-anixi-green text-white shadow-sm'
                  : 'text-[#4d675c] hover:bg-white/70 hover:text-[#0E2340]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.1} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <CardSkeleton rows={6} />
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-[#0E2340]">How patients see you</h2>
                  <p className="mt-1 text-[13px] text-[#65758b]">
                    Offer clinic visits, video consults, or both. Patients pick one when they book.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <VisitModeCard
                    icon={Building2}
                    title="Clinic visits"
                    description="In-person appointments at your practice."
                    enabled={offersClinic}
                    disabled={!isOwner || savingVisitModes}
                    onToggle={() => void handleSaveVisitModes(!offersClinic, offersVideo)}
                  />
                  <VisitModeCard
                    icon={Video}
                    title="Video consultation"
                    description="Remote video appointments with patients."
                    enabled={offersVideo}
                    disabled={!isOwner || savingVisitModes}
                    onToggle={() => void handleSaveVisitModes(offersClinic, !offersVideo)}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#0E2340]">Practice details</h2>
                    <p className="mt-1 text-[13px] text-[#65758b]">
                      Name, timezone, and letterhead used on invoices and prescriptions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/professional-profile?tab=practice')}
                    className="text-[13px] font-semibold text-anixi-green hover:underline"
                  >
                    Edit in profile
                  </button>
                </div>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#f6f8fa] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                      Practice name
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0E2340]">{practice.name}</p>
                  </div>
                  <div className="rounded-xl bg-[#f6f8fa] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                      Timezone
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0E2340]">{practice.timezone}</p>
                  </div>
                </div>
                <PracticeLogoUploader logoUrl={doctor?.logoUrl} />
              </section>

              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#0E2340]">Locations</h2>
                    <p className="mt-1 text-[13px] text-[#65758b]">
                      Where clinic visits happen, plus a video option if you offer remote consults.
                    </p>
                  </div>
                  {isOwner && !addingLocation && (
                    <button
                      type="button"
                      onClick={() => setAddingLocation(true)}
                      className="inline-flex h-9 items-center rounded-lg bg-anixi-green px-3.5 text-xs font-semibold text-white hover:bg-[#365c4f]"
                    >
                      Add location
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[#eef2f6] overflow-hidden rounded-xl border border-[#e1e7ef]">
                  {practice.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef4f1] text-anixi-green">
                          {loc.type === 'virtual' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#0E2340]">{loc.name}</p>
                          <p className="text-xs text-[#65758b]">
                            {LOCATION_TYPE_LABELS[loc.type]}
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
                    <p className="px-4 py-8 text-center text-[13px] text-[#94a3b8]">
                      No locations yet. Add your clinic address or a video consult option.
                    </p>
                  )}
                </div>

                {isOwner && addingLocation && (
                  <div className="mt-4 rounded-xl bg-[#f6f8fa] p-4">
                    <p className="mb-3 text-sm font-semibold text-[#0E2340]">New location</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        placeholder="Name (e.g. Main rooms)"
                        className="h-10 rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green"
                      />
                      <select
                        value={newLocType}
                        onChange={(e) => setNewLocType(e.target.value as PracticeLocation['type'])}
                        className="h-10 rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green"
                      >
                        <option value="clinic">Clinic visit</option>
                        <option value="virtual">Video consultation</option>
                      </select>
                      <input
                        value={newLocAddress}
                        onChange={(e) => setNewLocAddress(e.target.value)}
                        placeholder="Address (optional)"
                        className="h-10 rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingLocation(false);
                          setNewLocName('');
                          setNewLocAddress('');
                          setNewLocType('clinic');
                        }}
                        className="inline-flex h-9 items-center rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-xs font-semibold text-[#344256]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAddLocation()}
                        disabled={savingLoc || !newLocName.trim()}
                        className="inline-flex h-9 items-center rounded-lg bg-anixi-green px-4 text-xs font-semibold text-white hover:bg-[#365c4f] disabled:opacity-50"
                      >
                        {savingLoc ? 'Adding…' : 'Save location'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold capitalize text-[#0E2340]">
                  Your access · {role}
                </h2>
                <p className="mt-1 text-[13px] text-[#65758b]">
                  What you can change in this practice.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissionItems.map((p) => {
                    const enabled = Boolean(
                      member?.permissions[p.key as keyof typeof member.permissions]
                    );
                    return (
                      <div
                        key={p.key}
                        className="flex items-center gap-2.5 rounded-lg bg-[#f6f8fa] px-3 py-2"
                      >
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
              </section>
            </div>
          )}

          {activeTab === 'availability' &&
            (isClinicEmployedClinician || isOwner || can('manageAppointments') ? (
              <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
                <BookableBlocksEditor
                  practiceId={practice.id}
                  blocks={bookableBlocks}
                  locations={practice.locations}
                  timezone={practice.timezone}
                  practiceConsultTypes={practice.consultTypes}
                  onChanged={reload}
                  onPracticeUpdated={() => void refreshPracticeSession()}
                  readOnly={isClinicEmployedClinician}
                />
              </div>
            ) : (
              <PermissionDenied message="You don't have permission to manage availability." />
            ))}

          {activeTab === 'soft-blocks' &&
            (isClinicEmployedClinician ? (
              <PermissionDenied message="Blocked time is managed by your clinic administrator." />
            ) : isOwner || can('manageSoftBlocks') ? (
              <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
                <SoftBlocksEditor
                  practiceId={practice.id}
                  softBlocks={softBlocks}
                  onChanged={reload}
                />
              </div>
            ) : (
              <PermissionDenied message="You don't have permission to manage blocked time." />
            ))}

          {activeTab === 'policies' && bookingPolicy && (
            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
              {isClinicEmployedClinician && (
                <p className="mb-4 text-[13px] text-[#65758b]">
                  These rules are set by your clinic administrator and apply to all bookings.
                </p>
              )}
              <BookingPoliciesForm
                practiceId={practice.id}
                policy={bookingPolicy}
                onSaved={reload}
                readOnly={isClinicEmployedClinician || !can('editBookingPolicies')}
              />
            </div>
          )}

          {activeTab === 'team' && (
            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
              <PracticeMembersPanel />
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
              <PracticePermissionsPanel
                doctorId={user?.id ?? practice.ownerId}
                doctorName={user?.displayName ?? practice.name}
                isOwner={isOwner}
              />
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

const VisitModeCard: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}> = ({ icon: Icon, title, description, enabled, disabled, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className={`rounded-2xl border p-4 text-left transition ${
      enabled
        ? 'border-anixi-green bg-[#eef6f2] shadow-sm'
        : 'border-[#e1e7ef] bg-[#f8fafc] hover:border-anixi-green/40'
    } disabled:cursor-not-allowed disabled:opacity-70`}
  >
    <div className="flex items-start justify-between gap-3">
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
          enabled ? 'bg-anixi-green text-white' : 'bg-white text-[#65758b]'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
          enabled ? 'bg-anixi-green text-white' : 'bg-white text-[#8FA0B6]'
        }`}
      >
        {enabled ? 'Offered' : 'Off'}
      </span>
    </div>
    <p className="mt-3 text-sm font-semibold text-[#0E2340]">{title}</p>
    <p className="mt-1 text-[13px] leading-relaxed text-[#65758b]">{description}</p>
  </button>
);

const PermissionDenied: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-[#e1e7ef] bg-white text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f4f8] text-[#8FA0B6]">
      <Shield className="h-5 w-5" />
    </div>
    <p className="text-sm text-[#344256]">{message}</p>
    <p className="mt-1 text-xs text-[#94a3b8]">Contact the practice owner to request access.</p>
  </div>
);

export default PracticeSettingsPage;
