import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Heart, Stethoscope, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { AuthLayout } from '../components/auth/AuthLayout';
import { SignInPrompt } from '../components/auth/AuthLinks';
import type { JoinPath } from '../types/auth';

const PATHS: {
  path: JoinPath;
  label: string;
  description: string;
  Icon: typeof Stethoscope;
}[] = [
  {
    path: 'solo_doctor',
    label: 'Private practitioner',
    description: 'I run my own practice and manage my own patients & diary',
    Icon: Stethoscope,
  },
  {
    path: 'clinic',
    label: 'Clinic / group practice',
    description: 'Set up your clinic, upload doctors & patients',
    Icon: Building2,
  },
  {
    path: 'invite',
    label: 'I have an invite',
    description: 'A clinic invited me to join as a doctor or staff member',
    Icon: UserRound,
  },
  {
    path: 'caregiver',
    label: 'Caregiver',
    description: 'I support a patient and need caregiver access',
    Icon: Heart,
  },
];

export const Join: React.FC = () => {
  const [selected, setSelected] = useState<JoinPath | null>(null);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!selected) return;
    if (selected === 'solo_doctor') {
      navigate('/register?role=doctor&path=solo_doctor');
      return;
    }
    if (selected === 'clinic') {
      navigate('/register?role=doctor&path=clinic');
      return;
    }
    if (selected === 'invite') {
      navigate('/join/invite');
      return;
    }
    navigate('/register?role=caregiver&path=caregiver');
  };

  return (
    <AuthLayout
      title="Join Anixi Health"
      subtitle="Set up in minutes, whether you practise alone or run a clinic."
      maxWidth="2xl"
      compact
    >
      <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-lg sm:px-6 sm:py-6">
        <div className="mb-4 text-center">
          <h2 className="font-heading text-xl font-semibold text-gray-900 sm:text-[1.35rem]">
            How are you joining?
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            We&apos;ll tailor onboarding to your setup. No extra steps you don&apos;t need.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          {PATHS.map(({ path, label, description, Icon }) => {
            const isSelected = selected === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => setSelected(path)}
                className={clsx(
                  'group flex flex-row items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-200 sm:flex-col sm:gap-0 sm:p-4',
                  isSelected
                    ? 'border-anixi-green bg-anixi-green/[0.04] shadow-md'
                    : 'border-gray-200 bg-white hover:border-anixi-green/40 hover:shadow-sm'
                )}
              >
                <div
                  className={clsx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors sm:mb-2.5',
                    isSelected
                      ? 'bg-anixi-green text-white'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-anixi-green/10 group-hover:text-anixi-green'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[15px] font-semibold text-gray-900">{label}</span>
                  <span className="mt-1 block text-sm leading-snug text-gray-500">
                    {description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          className="mt-5 w-full rounded-full py-3 text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-gray-300 enabled:bg-anixi-green enabled:hover:opacity-90 enabled:hover:shadow-md"
        >
          Continue
        </button>

        <div className="mt-4">
          <SignInPrompt />
        </div>
      </div>
    </AuthLayout>
  );
};
