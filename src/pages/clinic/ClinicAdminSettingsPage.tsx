import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { usePracticeSettings } from '../../hooks/usePracticeSettings';
import { BookableBlocksEditor } from '../../components/practice/BookableBlocksEditor';
import { SoftBlocksEditor } from '../../components/practice/SoftBlocksEditor';
import { BookingPoliciesForm } from '../../components/practice/BookingPoliciesForm';
import { PracticeLogoUploader } from '../../components/practice/PracticeLogoUploader';
import { LetterheadSetupBanner } from '../../components/invoices/LetterheadSetupBanner';
import { Toast, SettingsPageSkeleton } from '../../components/ui';
import { TabPill } from '../../components/ui/TabPill';
import { PageHeader, PageShell } from '../../components/page-layout';
import {
  listPracticeClinicians,
  updatePractice,
} from '../../services/practiceSettingsService';
import { memberDisplayLabel } from '../../services/practiceMemberService';
import type { Doctor, PracticeLocation, PracticeMember } from '../../types';

type Tab = 'profile' | 'booking' | 'schedules';

const TAB_CONFIG: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Clinic profile' },
  { id: 'booking', label: 'Booking rules' },
  { id: 'schedules', label: 'Doctor schedules' },
];

const isValidTab = (value: string | null): value is Tab =>
  TAB_CONFIG.some((tab) => tab.id === value);

export const ClinicAdminSettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, practiceSession, refreshPracticeSession, isLoading: authLoading } = useAuth();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const { can } = usePermissions();
  const { bookableBlocks, softBlocks, bookingPolicy, isLoading, error, reload } =
    usePracticeSettings();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<Tab>(
    isValidTab(tabParam) ? tabParam : 'profile'
  );
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<PracticeLocation['type']>('clinic');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    name: '',
    timezone: '',
    tradingName: '',
    bhfPracticeNumber: '',
    listingPublished: false,
    listingTagline: '',
    listingDescription: '',
    listingCity: '',
    listingProvince: '',
    listingAcceptsMedicalAid: false,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const practice = practiceSession?.practice;
  const canEditProfile = can('manageMembers') || can('editBookingPolicies');
  const canEditBooking = can('editBookingPolicies');
  const canManageSchedules = can('manageAppointments');
  const canManageSoftBlocks = can('manageSoftBlocks');

  const visibleTabs = TAB_CONFIG.filter((tab) => {
    if (tab.id === 'profile') return true;
    if (tab.id === 'booking') return canEditBooking;
    if (tab.id === 'schedules') return canManageSchedules;
    return true;
  });

  useEffect(() => {
    if (practice) {
      setProfileDraft({
        name: practice.name || '',
        timezone: practice.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        tradingName: practice.tradingName || '',
        bhfPracticeNumber: practice.bhfPracticeNumber || '',
        listingPublished: practice.publicListing?.published ?? false,
        listingTagline: practice.publicListing?.tagline || '',
        listingDescription: practice.publicListing?.description || '',
        listingCity: practice.publicListing?.city || '',
        listingProvince: practice.publicListing?.province || '',
        listingAcceptsMedicalAid: practice.publicListing?.acceptsMedicalAid ?? false,
      });
    }
  }, [practice]);

  useEffect(() => {
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab('profile');
    }
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    if (!practice?.id) return;
    void listPracticeClinicians(practice.id).then((list) => {
      setClinicians(list);
      setSelectedDoctorId((prev) => prev || list[0]?.uid || '');
    });
  }, [practice?.id]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab }, { replace: true });
  };

  const doctorBlocks = useMemo(
    () =>
      selectedDoctorId
        ? bookableBlocks.filter((b) => b.doctorId === selectedDoctorId)
        : [],
    [bookableBlocks, selectedDoctorId]
  );

  const doctorSoftBlocks = useMemo(
    () =>
      selectedDoctorId
        ? softBlocks.filter((b) => b.doctorId === selectedDoctorId)
        : [],
    [softBlocks, selectedDoctorId]
  );

  const handleAddLocation = async () => {
    if (!practice || !newLocName.trim() || !canEditProfile) return;
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
    if (!practice || !canEditProfile) return;
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

  const handleSaveProfile = async () => {
    if (!practice || !profileDraft.name.trim() || !canEditProfile) return;
    setSavingProfile(true);
    try {
      await updatePractice(practice.id, {
        name: profileDraft.name.trim(),
        timezone: profileDraft.timezone.trim() || practice.timezone,
        tradingName: profileDraft.tradingName.trim() || undefined,
        bhfPracticeNumber: profileDraft.bhfPracticeNumber.trim() || undefined,
        publicListing: {
          published: profileDraft.listingPublished,
          slug: practice.publicListing?.slug || practice.id,
          tagline: profileDraft.listingTagline.trim() || undefined,
          description: profileDraft.listingDescription.trim() || undefined,
          city: profileDraft.listingCity.trim() || undefined,
          province: profileDraft.listingProvince.trim() || undefined,
          acceptsMedicalAid: profileDraft.listingAcceptsMedicalAid,
        },
      });
      await refreshPracticeSession();
      setToast({ visible: true, message: 'Clinic profile updated.', type: 'success' });
    } catch (e: unknown) {
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Failed to update profile.',
        type: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  if (authLoading || !practice) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <SettingsPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide" className="py-6 pb-10 sm:py-8">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <PageHeader
        title="Clinic settings"
        description="Manage your clinic profile, booking rules, and doctor availability."
      />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[#e1e7ef] pb-4">
        {visibleTabs.map((tab) => (
          <TabPill key={tab.id} active={activeTab === tab.id} onClick={() => selectTab(tab.id)}>
            {tab.label}
          </TabPill>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {isLoading && activeTab !== 'profile' ? (
        <SettingsPageSkeleton />
      ) : (
        <div className="mt-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <LetterheadSetupBanner doctor={doctor} className="rounded-2xl" />
              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Letterhead & logo
                </p>
                <p className="mt-2 text-sm text-[#65758b]">
                  Used on invoices, prescriptions, and patient communications for your entire clinic.
                </p>
                {canEditProfile ? (
                  <div className="mt-4">
                    <PracticeLogoUploader logoUrl={doctor?.logoUrl} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#65758b]">
                    Contact your clinic administrator to update branding.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Clinic identity
                </p>
                {canEditProfile ? (
                  <>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-[#65758b]">Clinic name</label>
                        <input
                          value={profileDraft.name}
                          onChange={(e) =>
                            setProfileDraft((d) => ({ ...d, name: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#65758b]">Timezone</label>
                        <input
                          value={profileDraft.timezone}
                          onChange={(e) =>
                            setProfileDraft((d) => ({ ...d, timezone: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#65758b]">Trading name</label>
                        <input
                          value={profileDraft.tradingName}
                          onChange={(e) =>
                            setProfileDraft((d) => ({ ...d, tradingName: e.target.value }))
                          }
                          placeholder="As shown on invoices"
                          className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#65758b]">
                          BHF practice number
                        </label>
                        <input
                          value={profileDraft.bhfPracticeNumber}
                          onChange={(e) =>
                            setProfileDraft((d) => ({ ...d, bhfPracticeNumber: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingProfile || !profileDraft.name.trim()}
                      onClick={() => void handleSaveProfile()}
                      className="mt-4 rounded-lg bg-anixi-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {savingProfile ? 'Saving…' : 'Save profile'}
                    </button>
                  </>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-[#65758b]">Clinic name</p>
                      <p className="mt-1 text-sm font-semibold text-[#344256]">{practice.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#65758b]">Timezone</p>
                      <p className="mt-1 text-sm font-semibold text-[#344256]">
                        {practice.timezone || 'Not set'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Public listing
                </p>
                <p className="mt-2 text-sm text-[#65758b]">
                  Publish your clinic on the patient marketplace when your profile is ready.
                </p>
                {canEditProfile ? (
                  <div className="mt-4 space-y-4">
                    <label className="flex items-center gap-2 text-sm text-[#344256]">
                      <input
                        type="checkbox"
                        checked={profileDraft.listingPublished}
                        onChange={(e) =>
                          setProfileDraft((d) => ({
                            ...d,
                            listingPublished: e.target.checked,
                          }))
                        }
                      />
                      Publish clinic on Anixi marketplace
                    </label>
                    <input
                      value={profileDraft.listingTagline}
                      onChange={(e) =>
                        setProfileDraft((d) => ({ ...d, listingTagline: e.target.value }))
                      }
                      placeholder="Short tagline"
                      className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                    />
                    <textarea
                      value={profileDraft.listingDescription}
                      onChange={(e) =>
                        setProfileDraft((d) => ({ ...d, listingDescription: e.target.value }))
                      }
                      placeholder="About your clinic"
                      rows={3}
                      className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input
                        value={profileDraft.listingCity}
                        onChange={(e) =>
                          setProfileDraft((d) => ({ ...d, listingCity: e.target.value }))
                        }
                        placeholder="City"
                        className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                      />
                      <input
                        value={profileDraft.listingProvince}
                        onChange={(e) =>
                          setProfileDraft((d) => ({ ...d, listingProvince: e.target.value }))
                        }
                        placeholder="Province"
                        className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[#344256]">
                      <input
                        type="checkbox"
                        checked={profileDraft.listingAcceptsMedicalAid}
                        onChange={(e) =>
                          setProfileDraft((d) => ({
                            ...d,
                            listingAcceptsMedicalAid: e.target.checked,
                          }))
                        }
                      />
                      Accepts medical aid
                    </label>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#65758b]">
                    {practice.publicListing?.published
                      ? 'This clinic is published on the marketplace.'
                      : 'Listing is not published yet.'}
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Locations
                </p>
                <ul className="mt-4 divide-y divide-[#eef2f6]">
                  {practice.locations.map((loc) => (
                    <li key={loc.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-[#344256]">{loc.name}</p>
                        {loc.address && (
                          <p className="text-sm text-[#65758b]">{loc.address}</p>
                        )}
                      </div>
                      {canEditProfile && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveLocation(loc.id)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                  {practice.locations.length === 0 && (
                    <li className="py-3 text-sm text-[#65758b]">No locations added yet.</li>
                  )}
                </ul>
                {canEditProfile && (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <input
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        placeholder="Location name"
                        className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                      />
                      <select
                        value={newLocType}
                        onChange={(e) =>
                          setNewLocType(e.target.value as PracticeLocation['type'])
                        }
                        className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                      >
                        <option value="clinic">Clinic</option>
                        <option value="hospital">Hospital</option>
                        <option value="virtual">Virtual</option>
                      </select>
                      <input
                        value={newLocAddress}
                        onChange={(e) => setNewLocAddress(e.target.value)}
                        placeholder="Address (optional)"
                        className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={savingLoc || !newLocName.trim()}
                      onClick={() => void handleAddLocation()}
                      className="mt-3 rounded-lg bg-anixi-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {savingLoc ? 'Adding…' : 'Add location'}
                    </button>
                  </>
                )}
              </section>
            </div>
          )}

          {activeTab === 'booking' && bookingPolicy && (
            <BookingPoliciesForm
              practiceId={practice.id}
              policy={bookingPolicy}
              onSaved={reload}
              readOnly={!canEditBooking}
            />
          )}

          {activeTab === 'schedules' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
                <label className="mb-2 block text-sm font-medium text-[#344256]">
                  Select doctor
                </label>
                {clinicians.length === 0 ? (
                  <p className="text-sm text-amber-700">
                    No doctors on the team yet. Invite doctors from Team & doctors, then set their
                    clinic hours here.
                  </p>
                ) : (
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                  >
                    {clinicians.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {memberDisplayLabel(c, practice.ownerId)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedDoctorId && canManageSchedules && (
                <BookableBlocksEditor
                  practiceId={practice.id}
                  blocks={doctorBlocks}
                  locations={practice.locations}
                  timezone={practice.timezone}
                  practiceConsultTypes={practice.consultTypes}
                  onChanged={reload}
                  onPracticeUpdated={() => void refreshPracticeSession()}
                  doctorId={selectedDoctorId}
                />
              )}

              {selectedDoctorId && canManageSoftBlocks && (
                <SoftBlocksEditor
                  practiceId={practice.id}
                  softBlocks={doctorSoftBlocks}
                  onChanged={reload}
                  doctorId={selectedDoctorId}
                />
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
};

export default ClinicAdminSettingsPage;
