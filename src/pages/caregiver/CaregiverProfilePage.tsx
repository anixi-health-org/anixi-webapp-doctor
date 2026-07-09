import React, { useEffect, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Toast } from '../../components/ui';
import { PageHeaderSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { getCaregiverProfile, updateCaregiverProfile } from '../../services/caregiverService';

export const CaregiverProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [organization, setOrganization] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    if (!user?.id) return;
    void getCaregiverProfile(user.id).then((profile) => {
      if (profile) {
        setDisplayName(profile.displayName || '');
        setPhoneNumber(profile.phoneNumber || '');
        setOrganization(profile.organization || '');
      }
      setLoading(false);
    });
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateCaregiverProfile(user.id, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        organization: organization.trim(),
      });
      setToast({ visible: true, message: 'Profile updated successfully.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to update profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="max-w-2xl">
        <PageHeaderSkeleton />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-2xl">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <PageHeader
        title="My Profile"
        description="Your professional caregiver details visible to care teams and patients."
      />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Full name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <input
                value={user?.email || ''}
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone number</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+27 …"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Organisation / facility
              </label>
              <input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Community Health Centre, Home care"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
              <p className="mt-1 text-xs text-gray-500">
                Hospital, clinic, NGO, or community group you represent (optional).
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-anixi-green px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
};
