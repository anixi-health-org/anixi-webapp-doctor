import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { usePracticeSettings } from '../hooks/usePracticeSettings';
import { BookableBlocksEditor } from '../components/practice/BookableBlocksEditor';
import { SoftBlocksEditor } from '../components/practice/SoftBlocksEditor';
import { BookingPoliciesForm } from '../components/practice/BookingPoliciesForm';
import { PracticePermissionsPanel } from '../components/practice/PracticePermissionsPanel';
import { Toast } from '../components/ui';
import { updatePractice } from '../services/practiceSettingsService';

type Tab = 'overview' | 'availability' | 'soft-blocks' | 'policies' | 'permissions';

const PRACTICE_BRAND = {
  primary: '#516059',
  primaryDark: '#45524D',
  subtle: '#EEF2F0',
  border: '#C6CFCA',
};

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Practice Overview', icon: '🏢' },
  { id: 'availability', label: 'Bookable Blocks', icon: '🟢' },
  { id: 'soft-blocks', label: 'Soft Blocks', icon: '🔒' },
  { id: 'policies', label: 'Booking Policies', icon: '📋' },
  { id: 'permissions', label: 'Practice Permissions', icon: '🛡️' },
];

const PracticeSettingsPage: React.FC = () => {
  const { practiceSession, refreshPracticeSession } = useAuth();
  const { can, isOwner, role } = usePermissions();
  const { bookableBlocks, softBlocks, bookingPolicy, isLoading, error, reload } =
    usePracticeSettings();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editingName, setEditingName] = useState(false);
  const [practiceNameDraft, setPracticeNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const practice = practiceSession?.practice;
  const member = practiceSession?.member;

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  if (!practice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No practice found. Contact support.</p>
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

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-5xl mx-auto">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-gray-900">Practice Settings</h1>
          <span
            className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
              isOwner
                ? 'bg-[#EEF2F0] text-[#45524D] border border-[#C6CFCA]'
                : 'bg-[#EEF2F0] text-[#516059] border border-[#C6CFCA]'
            }`}
          >
            {isOwner ? 'Owner' : 'Delegate'}
          </span>
        </div>
        <p className="text-gray-600 text-sm">
          Manage your practice availability, blocked time, and booking rules.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#516059] text-[#45524D]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Practice Name
                </label>
                {editingName ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={practiceNameDraft}
                      onChange={(e) => setPracticeNameDraft(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
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
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
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
                <p className="text-gray-900">{practice.timezone}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Access Level
                </label>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900 capitalize mb-3">{role}</p>
                  <div className="grid grid-cols-2 gap-2">
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

              {practice.locations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Locations</label>
                  <div className="space-y-1">
                    {practice.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <span className="text-gray-400">📍</span> {loc.name}
                        {loc.address && (
                          <span className="text-gray-400 text-xs">· {loc.address}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bookable Blocks */}
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

          {/* Soft Blocks */}
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

          {/* Booking Policies */}
          {activeTab === 'policies' && bookingPolicy && (
            <BookingPoliciesForm
              practiceId={practice.id}
              policy={bookingPolicy}
              onSaved={reload}
              readOnly={!can('editBookingPolicies')}
            />
          )}

          {/* Practice Permissions */}
          {activeTab === 'permissions' && (
            <PracticePermissionsPanel
              practiceId={practice.id}
              isOwner={isOwner}
            />
          )}
        </div>
      )}
    </div>
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
