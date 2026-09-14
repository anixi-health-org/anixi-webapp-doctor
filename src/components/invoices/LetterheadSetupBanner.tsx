import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { getMissingClinicLetterheadFields } from '../../lib/invoiceLetterhead';
import { usePermissions } from '../../hooks/usePermissions';
import { getDoctorProfile } from '../../services/doctorService';
import type { Doctor, Practice } from '../../types';

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

/** Marked optional on the professional profile form, should not block letterhead setup. */
const OPTIONAL_LETTERHEAD_FIELD_KEYS = new Set<LetterheadFieldKey>([
  'practiceNumberBhf',
  'vatNumber',
]);

type LetterheadDoctor = Doctor & {
  practiceNumber?: string;
  hpcsaRegistrationNumber?: string;
  practiceAddress?: string;
  profileImageUrl?: string;
};

export function resolveLetterheadFieldValue(
  doctor: LetterheadDoctor | null | undefined,
  key: LetterheadFieldKey
): string {
  if (!doctor) return '';

  switch (key) {
    case 'logoUrl':
      return String(doctor.logoUrl ?? '').trim();
    case 'practiceName':
      return String(doctor.practiceName ?? '').trim();
    case 'officeAddress':
      return String(doctor.officeAddress ?? doctor.practiceAddress ?? '').trim();
    case 'phoneNumber':
      return String(doctor.phoneNumber ?? '').trim();
    case 'licenseNumber':
      return String(doctor.licenseNumber ?? doctor.hpcsaRegistrationNumber ?? '').trim();
    case 'practiceNumberBhf':
      return String(doctor.practiceNumberBhf ?? doctor.practiceNumber ?? '').trim();
    case 'vatNumber':
      return String(doctor.vatNumber ?? '').trim();
    default:
      return '';
  }
}

export function getMissingLetterheadFields(doctor: Doctor | null | undefined) {
  if (!doctor) return [];
  return LETTERHEAD_FIELDS.filter(
    ({ key }) =>
      !OPTIONAL_LETTERHEAD_FIELD_KEYS.has(key) &&
      !resolveLetterheadFieldValue(doctor, key)
  );
}

export { getMissingClinicLetterheadFields };

interface LetterheadSetupBannerProps {
  doctor: Doctor | null | undefined;
  practice?: Practice | null;
  className?: string;
  /** Slightly shorter copy for the create-invoice flow */
  compact?: boolean;
}

export const LetterheadSetupBanner: React.FC<LetterheadSetupBannerProps> = ({
  doctor,
  practice,
  className = '',
  compact = false,
}) => {
  const navigate = useNavigate();
  const { isClinicEmployedClinician } = usePermissions();
  const [dismissed, setDismissed] = useState(false);
  const [resolvedDoctor, setResolvedDoctor] = useState<Doctor | null | undefined>(doctor);
  const isClinicPractice = practice?.orgType === 'clinic';

  useEffect(() => {
    setResolvedDoctor(doctor);
  }, [doctor]);

  useEffect(() => {
    const doctorId = doctor?.id;
    if (!doctorId || isClinicPractice) return;

    let cancelled = false;
    void getDoctorProfile(doctorId).then((fresh) => {
      if (!cancelled && fresh) {
        setResolvedDoctor(fresh);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [doctor?.id, isClinicPractice]);

  const missingLetterhead = useMemo(
    () =>
      isClinicPractice
        ? getMissingClinicLetterheadFields(practice)
        : getMissingLetterheadFields(resolvedDoctor ?? doctor),
    [isClinicPractice, practice, resolvedDoctor, doctor]
  );
  const missingLogo = missingLetterhead.some(({ key }) => key === 'logoUrl');

  if (isClinicEmployedClinician || missingLetterhead.length === 0 || dismissed) {
    return null;
  }

  if (!isClinicPractice && !doctor) {
    return null;
  }

  const settingsPath = isClinicPractice ? '/clinic/settings' : '/practice-settings';
  const detailsPath = isClinicPractice
    ? '/clinic/settings'
    : '/professional-profile?tab=practice';

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
                ? isClinicPractice
                  ? 'Add clinic letterhead before sending invoices'
                  : 'Add your letterhead before sending invoices'
                : isClinicPractice
                  ? 'Finish the clinic invoice letterhead'
                  : 'Finish your invoice letterhead'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
              {compact
                ? missingLogo
                  ? isClinicPractice
                    ? 'Clinic invoices print with organisation branding. Without a logo they go out unbranded.'
                    : 'PDF exports print with your practice branding. Without a logo they go out unbranded.'
                  : 'A few practice details are still missing from your letterhead.'
                : isClinicPractice
                  ? (
                    <>
                      Invoices for this hospital or clinic use organisation branding, not an
                      individual doctor&apos;s letterhead.
                      {missingLogo
                        ? ' Without a clinic logo they go out unbranded.'
                        : ' A few clinic details are still missing.'}
                    </>
                  )
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
            onClick={() => {
              if (missingLogo) {
                const input = document.getElementById('practice-logo-file-input');
                if (input instanceof HTMLInputElement) {
                  input.click();
                  return;
                }
                navigate(settingsPath);
                return;
              }
              navigate(detailsPath);
            }}
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
