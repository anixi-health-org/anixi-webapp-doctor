import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { usePracticeSettings } from '../hooks/usePracticeSettings';
import { BookableBlocksEditor } from '../components/practice/BookableBlocksEditor';
import { SoftBlocksEditor } from '../components/practice/SoftBlocksEditor';
import { BookingPoliciesForm } from '../components/practice/BookingPoliciesForm';
import { PracticePermissionsPanel } from '../components/practice/PracticePermissionsPanel';
import { Toast } from '../components/ui';
import { TabPill } from '../components/ui/TabPill';
import { PageHeader, PageShell } from '../components/page-layout';
import { updatePractice, provisionPracticeForDoctor } from '../services/practiceSettingsService';
import type { ConsultType, PracticeLocation } from '../types';

type Tab = 'overview' | 'availability' | 'soft-blocks' | 'policies' | 'permissions';

const PRACTICE_BRAND = {
  primary: '#516059',
  primaryDark: '#45524D',
  subtle: '#EEF2F0',
  border: '#C6CFCA',
};

const TAB_CONFIG: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Practice Overview' },
  { id: 'availability', label: 'Bookable Blocks' },
  { id: 'soft-blocks', label: 'Soft Blocks' },
  { id: 'policies', label: 'Booking Policies' },
  { id: 'permissions', label: 'Practice Permissions' },
];

const PracticeSettingsPage: React.FC = () => {
  const { user, practiceSession, refreshPracticeSession, isLoading: authLoading } = useAuth();
  const { can, isOwner, role } = usePermissions();
  const { bookableBlocks, softBlocks, bookingPolicy, isLoading, error, reload } =
    usePracticeSettings();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editingName, setEditingName] = useState(false);
  const [practiceNameDraft, setPracticeNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [editingTimezone, setEditingTimezone] = useState(false);
  const [timezoneDraft, setTimezoneDraft] = useState('');
  const [savingTimezone, setSavingTimezone] = useState(false);

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
        name: user.displayName ? `${user.displayName}'s Practice` : 'My Practice',
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[#516059] rounded-full" />
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12 max-w-lg mx-auto text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Set up your practice</h1>
        <p className="text-gray-600 text-sm mb-6">
          We couldn&apos;t load a practice for your account yet. This usually happens on first login
          or when Firestore rules haven&apos;t been deployed. You can create your practice now.
        </p>
        <button
          type="button"
          onClick={handleProvisionPractice}
          disabled={provisioning || !user?.id}
          className="px-6 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#516059' }}
        >
          {provisioning ? 'Setting up…' : 'Create My Practice'}
        </button>
        <button
          type="button"
          onClick={() => refreshPracticeSession()}
          className="block mx-auto mt-4 text-sm text-[#516059] underline"
        >
          Retry loading
        </button>
      </div>
    );
  }

  const handleSaveName = async () => {
    if (!practiceNameDraft.trim()) return;
    setSavingName(true);
    try {
      await updatePractice(practice.id, { name: practiceNameDraft.trim() });
      await refreshPracticeSession();
      setEditingName(false);
      setToast({ visible: true, message: 'Practice name updated successfully.', type: 'success' });
    } catch (e: any) {
      setToast({
        visible: true,
        message: e?.message ?? 'Failed to update practice name.',
        type: 'error',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveTimezone = async () => {
    if (!timezoneDraft.trim()) return;
    setSavingTimezone(true);
    try {
      await updatePractice(practice.id, { timezone: timezoneDraft.trim() });
      await refreshPracticeSession();
      setEditingTimezone(false);
      setToast({ visible: true, message: 'Timezone updated.', type: 'success' });
    } catch (e: any) {
      setToast({ visible: true, message: e?.message ?? 'Failed to update timezone.', type: 'error' });
    } finally {
      setSavingTimezone(false);
    }
  };

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
    } catch (e: any) {
      setToast({ visible: true, message: e?.message ?? 'Failed to add location.', type: 'error' });
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
    } catch (e: any) {
      setToast({ visible: true, message: e?.message ?? 'Failed to remove location.', type: 'error' });
    }
  };

  const handleSaveConsultTypes = async () => {
    setSavingConsultTypes(true);
    try {
      await updatePractice(practice.id, { consultTypes: consultTypesDraft });
      await refreshPracticeSession();
      setToast({ visible: true, message: 'Consult types updated.', type: 'success' });
    } catch (e: any) {
      setToast({ visible: true, message: e?.message ?? 'Failed to update consult types.', type: 'error' });
    } finally {
      setSavingConsultTypes(false);
    }
  };

  return (
    <PageShell className="max-w-5xl pb-8">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <PageHeader
        title="Practice Settings"
        description="Manage your practice availability, blocked time, and booking rules."
        badge={
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isOwner
                ? 'border border-[#C6CFCA] bg-[#EEF2F0] text-[#45524D]'
                : 'border border-[#C6CFCA] bg-[#EEF2F0] text-[#516059]'
            }`}
          >
            {isOwner ? 'Owner' : 'Delegate'}
          </span>
        }
      />

      
      <div className="mb-6 flex gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
        {TAB_CONFIG.map((tab) => (
          <TabPill
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            active={activeTab === tab.id}
            className="min-w-0 flex-1 px-2 py-2.5 text-center text-xs leading-tight sm:px-3 sm:text-sm"
          >
            {tab.label}
          </TabPill>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[#516059] rounded-full" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="p-4 sm:p-6">
          {}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Practice Name
                </label>
                {editingName ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      autoFocus
                      value={practiceNameDraft}
                      onChange={(e) => setPracticeNameDraft(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 w-full sm:w-auto"
                      style={{ backgroundColor: PRACTICE_BRAND.primary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primaryDark;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primary;
                      }}
                    >
                      {savingName ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900 font-medium">{practice.name}</p>
                    {isOwner && (
                      <button
                        onClick={() => {
                          setPracticeNameDraft(practice.name);
                          setEditingName(true);
                        }}
                        className="text-xs text-[#516059] hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                {editingTimezone ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      autoFocus
                      value={timezoneDraft}
                      onChange={(e) => setTimezoneDraft(e.target.value)}
                      placeholder="e.g. Africa/Johannesburg"
                      className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                    />
                    <button
                      onClick={handleSaveTimezone}
                      disabled={savingTimezone}
                      className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: PRACTICE_BRAND.primary }}
                    >
                      {savingTimezone ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingTimezone(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900">{practice.timezone}</p>
                    {isOwner && (
                      <button
                        onClick={() => { setTimezoneDraft(practice.timezone); setEditingTimezone(true); }}
                        className="text-xs text-[#516059] hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Access Level
                </label>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900 capitalize mb-3">{role}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'manageAppointments', label: 'Manage Appointments' },
                      { key: 'manageSoftBlocks', label: 'Manage Soft Blocks' },
                      { key: 'overrideConflicts', label: 'Override Conflicts' },
                      { key: 'editBookingPolicies', label: 'Edit Booking Policies' },
                    ].map((p) => (
                      <div key={p.key} className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            member?.permissions[p.key as keyof typeof member.permissions]
                              ? 'bg-[#B7A06A]'
                              : 'bg-gray-300'
                          }`}
                        />
                        <span className="text-xs text-gray-700">{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Locations</label>
                <div className="space-y-2">
                  {practice.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between gap-2 p-2.5 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-400">📍</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{loc.name}</p>
                          <p className="text-xs text-gray-500 capitalize">
                            {loc.type}{loc.address ? ` · ${loc.address}` : ''}
                          </p>
                        </div>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveLocation(loc.id)}
                          className="text-xs text-red-500 hover:text-red-700 shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {practice.locations.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No locations added yet.</p>
                  )}
                </div>
                {isOwner && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-gray-600">Add a location</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        placeholder="Location name"
                        className="text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                      />
                      <select
                        value={newLocType}
                        onChange={(e) => setNewLocType(e.target.value as PracticeLocation['type'])}
                        className="text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]"
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
                        className="text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                      />
                    </div>
                    <button
                      onClick={handleAddLocation}
                      disabled={savingLoc || !newLocName.trim()}
                      className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: PRACTICE_BRAND.primary }}
                    >
                      {savingLoc ? 'Adding…' : 'Add Location'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Consult Types</label>
                <div className="flex flex-wrap gap-2">
                  {(['initial', 'follow-up', 'urgent', 'procedure', 'teleconsult', 'other'] as ConsultType[]).map((ct) => {
                    const active = consultTypesDraft.includes(ct);
                    return (
                      <button
                        key={ct}
                        onClick={() => {
                          if (!isOwner) return;
                          setConsultTypesDraft((prev) =>
                            active ? prev.filter((t) => t !== ct) : [...prev, ct]
                          );
                        }}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          active
                            ? 'bg-[#516059] text-white border-[#516059]'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#516059]'
                        } ${!isOwner ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {ct}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">Toggle which consult types this practice offers.</p>
              </div>
            </div>
          )}

          {}
          {activeTab === 'availability' && (
            can('manageAppointments') ? (
              <BookableBlocksEditor
                practiceId={practice.id}
                blocks={bookableBlocks}
                locations={practice.locations}
                onChanged={reload}
              />
            ) : (
              <PermissionDenied message="You don't have permission to manage availability blocks." />
            )
          )}

          {}
          {activeTab === 'soft-blocks' && (
            can('manageSoftBlocks') ? (
              <SoftBlocksEditor
                practiceId={practice.id}
                softBlocks={softBlocks}
                onChanged={reload}
              />
            ) : (
              <PermissionDenied message="You don't have permission to manage soft blocks." />
            )
          )}

          {}
          {activeTab === 'policies' && bookingPolicy && (
            <BookingPoliciesForm
              practiceId={practice.id}
              policy={bookingPolicy}
              onSaved={reload}
              readOnly={!can('editBookingPolicies')}
            />
          )}

          {}
          {activeTab === 'permissions' && (
            <PracticePermissionsPanel
              doctorId={user?.id ?? practice.ownerId}
              doctorName={user?.displayName ?? practice.name}
              isOwner={isOwner}
            />
          )}
          </div>

          {activeTab === 'overview' && isOwner && (
            <div className="flex justify-end border-t border-gray-200 bg-gray-50/60 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={handleSaveConsultTypes}
                disabled={savingConsultTypes}
                className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: PRACTICE_BRAND.primary }}
                onMouseEnter={(e) => {
                  if (!savingConsultTypes) {
                    e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primaryDark;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primary;
                }}
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
  <div className="flex flex-col items-center justify-center h-40 text-center">
    <span className="text-4xl mb-3">🔒</span>
    <p className="text-gray-600 text-sm">{message}</p>
    <p className="text-gray-400 text-xs mt-1">Contact the practice owner to request access.</p>
  </div>
);

export default PracticeSettingsPage;
