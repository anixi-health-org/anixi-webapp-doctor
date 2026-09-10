import React, { useEffect, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Toast } from '../../components/ui';
import { PageHeaderSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { getCaregiverProfile, updateCaregiverProfile } from '../../services/caregiverService';
import type { CaregiverTier } from '../../types';

export const CaregiverProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [organization, setOrganization] = useState('');
  const [caregiverTier, setCaregiverTier] = useState<CaregiverTier>('family');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [services, setServices] = useState('');
  const [published, setPublished] = useState(false);
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
        setOrganization(profile.organization || profile.professionalCaregiverProfile?.organization || '');
        setCaregiverTier(profile.caregiverTier ?? 'family');
        setBio(profile.professionalCaregiverProfile?.bio || '');
        setCity(profile.professionalCaregiverProfile?.city || '');
        setProvince(profile.professionalCaregiverProfile?.province || '');
        setServices((profile.professionalCaregiverProfile?.services ?? []).join(', '));
        setPublished(profile.professionalCaregiverProfile?.published === true);
      }
      setLoading(false);
    });
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    try {
      const serviceList = services
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateCaregiverProfile(user.id, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        organization: organization.trim(),
        caregiverTier,
        professionalCaregiverProfile:
          caregiverTier === 'professional'
            ? {
                organization: organization.trim(),
                services: serviceList,
                bio: bio.trim(),
                city: city.trim(),
                province: province.trim(),
                published,
              }
            : undefined,
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
        description="Your caregiver details, family carers support loved ones; professional carers can list services in the patient marketplace."
      />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Caregiver type</label>
              <select
                value={caregiverTier}
                onChange={(e) => setCaregiverTier(e.target.value as CaregiverTier)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                <option value="family">Family / informal carer</option>
                <option value="professional">Professional carer</option>
              </select>
            </div>
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
            </div>

            {caregiverTier === 'professional' ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Services</label>
                  <input
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    placeholder="Home visits, medication reminders, transport"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Comma-separated list</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Province</label>
                    <input
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                  />
                  List my profile in the patient marketplace
                </label>
              </>
            ) : null}

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
