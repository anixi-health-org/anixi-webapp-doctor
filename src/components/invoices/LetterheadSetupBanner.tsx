import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ImageIcon } from 'lucide-react';
import type { Doctor } from '../../types';

/** Fields the invoice PDF letterhead is built from - see invoicePdfService. */
export const LETTERHEAD_FIELDS = [
  { key: 'logoUrl', label: 'Practice logo' },
  { key: 'practiceName', label: 'Practice name' },
  { key: 'officeAddress', label: 'Practice address' },
  { key: 'phoneNumber', label: 'Contact number' },
  { key: 'licenseNumber', label: 'HPCSA number' },
  { key: 'practiceNumberBhf', label: 'BHF practice number' },
  { key: 'vatNumber', label: 'VAT number' },
] as const;

export type LetterheadFieldKey = (typeof LETTERHEAD_FIELDS)[number]['key'];

export function getMissingLetterheadFields(doctor: Doctor | null | undefined) {
  if (!doctor) return [];
  return LETTERHEAD_FIELDS.filter(({ key }) => !String(doctor[key] ?? '').trim());
}

interface LetterheadSetupBannerProps {
  doctor: Doctor | null | undefined;
  className?: string;
  /** Slightly shorter copy for the create-invoice flow */
  compact?: boolean;
}

export const LetterheadSetupBanner: React.FC<LetterheadSetupBannerProps> = ({
  doctor,
  className = '',
  compact = false,
}) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const missingLetterhead = useMemo(() => getMissingLetterheadFields(doctor), [doctor]);
  const missingLogo = missingLetterhead.some(({ key }) => key === 'logoUrl');

  if (!doctor || missingLetterhead.length === 0 || dismissed) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/70 px-5 py-4 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {missingLogo
                ? 'Add your letterhead before sending invoices'
                : 'Finish your invoice letterhead'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
              {compact
                ? missingLogo
                  ? 'PDF exports print with your practice branding. Without a logo they go out unbranded.'
                  : 'A few practice details are still missing from your letterhead.'
                : (
                  <>
                    Invoice and prescription PDFs are printed with your practice branding.
                    {missingLogo
                      ? ' Without a logo they go out unbranded.'
                      : ' A few details are still missing.'}
                  </>
                )}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {missingLetterhead.map(({ key, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => navigate('/professional-profile')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            {missingLogo ? 'Upload logo' : 'Complete details'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LetterheadSetupBanner;
