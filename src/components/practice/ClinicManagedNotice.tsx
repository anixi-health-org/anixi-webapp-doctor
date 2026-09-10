import React from 'react';
import { Building2 } from 'lucide-react';

interface Props {
  practiceName?: string;
  className?: string;
}

/** Shown to clinic-employed clinicians whose schedule and branding are admin-managed. */
export const ClinicManagedNotice: React.FC<Props> = ({ practiceName, className = '' }) => (
  <div
    className={`flex gap-3 rounded-2xl border border-[#dbe8e3] bg-[#eef6f2] px-4 py-3.5 sm:px-5 ${className}`}
    role="status"
  >
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-anixi-green text-white">
      <Building2 className="h-5 w-5" aria-hidden />
    </span>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[#0E2340]">Clinic-managed schedule</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#4d675c]">
        {practiceName ? (
          <>
            <span className="font-medium">{practiceName}</span> manages your booking hours, clinic
            branding, locations, and booking rules. You can view your assigned schedule below — contact
            your clinic administrator to request changes.
          </>
        ) : (
          <>
            Your clinic administrator manages booking hours, branding, and booking rules. You can view
            your assigned schedule below.
          </>
        )}
      </p>
    </div>
  </div>
);
