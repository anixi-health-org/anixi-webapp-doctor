import React from 'react';
import { Building2 } from 'lucide-react';

interface Props {
  practiceName?: string;
  surface?: 'schedule' | 'calendar' | 'settings' | 'onboarding';
  className?: string;
}

const COPY: Record<NonNullable<Props['surface']>, { title: string; body: string; fallback: string }> = {
  schedule: {
    title: 'Clinic-managed schedule',
    body: 'manages your booking hours, clinic branding, locations, and booking rules. You can view your assigned schedule below. Contact your clinic administrator to request changes.',
    fallback:
      'Your clinic administrator manages booking hours, branding, and booking rules. You can view your assigned schedule below.',
  },
  calendar: {
    title: 'Calendar managed by your clinic',
    body: 'manages your diary, clinic hours, and blocked time. You can review your assigned appointments here. Contact your clinic administrator if something needs to change.',
    fallback:
      'Your clinic administrator manages this calendar, clinic hours, and blocked time. Contact them if you need a change.',
  },
  settings: {
    title: 'Settings managed by your clinic',
    body: 'manages practice settings, branding, locations, and booking rules. Ask your clinic administrator if you need something updated.',
    fallback:
      'Your clinic administrator manages practice settings, branding, locations, and booking rules. Contact them if you need a change.',
  },
  onboarding: {
    title: 'Your clinic is already set up',
    body: 'already has the practice name, location, timezone, and branding. Complete your personal and professional details. Anixi Admin only needs those for your credentials review.',
    fallback:
      'Your clinic already has practice name, location, timezone, and branding. Complete your personal and professional details for credentials review.',
  },
};

/** Shown to clinic-employed clinicians whose schedule and branding are admin-managed. */
export const ClinicManagedNotice: React.FC<Props> = ({
  practiceName,
  surface = 'schedule',
  className = '',
}) => {
  const copy = COPY[surface];

  return (
    <div
      className={`flex gap-3 rounded-2xl border border-[#dbe8e3] bg-[#eef6f2] px-4 py-3.5 sm:px-5 ${className}`}
      role="status"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-anixi-green text-white">
        <Building2 className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0E2340]">{copy.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4d675c]">
          {practiceName ? (
            <>
              <span className="font-medium">{practiceName}</span> {copy.body}
            </>
          ) : (
            copy.fallback
          )}
        </p>
      </div>
    </div>
  );
};
