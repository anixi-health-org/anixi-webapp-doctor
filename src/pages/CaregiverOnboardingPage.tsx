import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Smartphone, UserPlus } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { useAuth } from '../hooks/AuthContext';
import { getJoinPathConfig } from '../lib/joinPathConfig';
import { updateCaregiverProfile } from '../services/caregiverService';
import type { CaregiverTier } from '../types';

const IOS_APP_LINK = 'https://apps.apple.com/app/anixi-health';
const ANDROID_APP_LINK = 'https://play.google.com/store/apps/details?id=com.anixi.health';

const caregiverOnboardingKey = (userId: string) => `anixi_caregiver_onboarding_complete_${userId}`;

export function markCaregiverOnboardingComplete(userId: string) {
  localStorage.setItem(caregiverOnboardingKey(userId), '1');
}

export function readCaregiverOnboardingComplete(userId: string): boolean {
  return localStorage.getItem(caregiverOnboardingKey(userId)) === '1';
}

export const CaregiverOnboardingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const config = getJoinPathConfig('caregiver');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [caregiverTier, setCaregiverTier] = useState<CaregiverTier>('family');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finish = () => {
    if (user?.id) markCaregiverOnboardingComplete(user.id);
    navigate('/caregiver', { replace: true });
  };

  const handleProfileContinue = async () => {
    if (!user?.id) return;
    setError('');
    setSaving(true);
    try {
      await updateCaregiverProfile(user.id, {
        displayName: user.displayName,
        phoneNumber: phoneNumber.trim(),
        caregiverTier,
      });
      setStep(2);
    } catch {
      setError('Could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title={step === 1 ? 'Tell us about you' : step === 2 ? 'How linking works' : 'Get the patient app'}
      subtitle={
        step === 1
          ? 'Step 1 of 3 — caregiver profile'
          : step === 2
            ? 'Step 2 of 3 — patient must link you'
            : 'Step 3 of 3 — optional for your patient'
      }
      maxWidth="lg"
      heroSlides={config.heroSlides}
    >
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-7 shadow-lg sm:px-8">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+27…"
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">I am a…</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ['family', 'Family or friend caregiver'],
                    ['professional', 'Professional caregiver'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCaregiverTier(value)}
                    className={`rounded-xl border-2 px-3 py-3 text-left text-sm transition ${
                      caregiverTier === value
                        ? 'border-anixi-green bg-anixi-green/[0.04] font-medium text-gray-900'
                        : 'border-gray-200 text-gray-600 hover:border-anixi-green/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleProfileContinue()}
              className="w-full rounded-full bg-anixi-green py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex gap-3 rounded-xl bg-[#fafcfb] px-4 py-3.5">
              <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-anixi-green" />
              <p className="text-sm leading-relaxed text-gray-600">
                The patient installs the <strong>Anixi Health</strong> app, opens{' '}
                <strong>Caregivers</strong>, and sends you an invite using your email (
                {user?.email}).
              </p>
            </div>
            <div className="flex gap-3 rounded-xl bg-[#fafcfb] px-4 py-3.5">
              <Heart className="mt-0.5 h-5 w-5 shrink-0 text-anixi-green" />
              <p className="text-sm leading-relaxed text-gray-600">
                Once linked, you can view adherence, appointments, and updates permitted by the
                patient — all POPIA-compliant.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full rounded-full bg-anixi-green py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex gap-3 rounded-xl bg-[#fafcfb] px-4 py-3.5">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-anixi-green" />
              <p className="text-sm leading-relaxed text-gray-600">
                Ask your patient to download the app so they can link you and manage their health
                record.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={IOS_APP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-800 hover:border-anixi-green/40"
              >
                App Store
              </a>
              <a
                href={ANDROID_APP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-800 hover:border-anixi-green/40"
              >
                Google Play
              </a>
            </div>
            <button
              type="button"
              onClick={finish}
              className="w-full rounded-full bg-anixi-green py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Open caregiver dashboard
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default CaregiverOnboardingPage;
