import React from 'react';
import type { BookingPolicy, Practice } from '../../types';
import { normalizeBillingProfile, formatBankingDetailsBlock } from '../../lib/practiceBillingProfile';

interface Props {
  practice: Practice;
  bookingPolicy?: BookingPolicy | null;
  className?: string;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f8fa] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0E2340]">{value || '—'}</p>
    </div>
  );
}

/** Read-only snapshot of clinic-owned settings inherited by employed physicians. */
export const ClinicInheritedSettingsPanel: React.FC<Props> = ({
  practice,
  bookingPolicy,
  className = '',
}) => {
  const primaryLocation = practice.locations?.[0];
  const billing = normalizeBillingProfile(practice.billingProfile);
  const bankingNote = formatBankingDetailsBlock(billing);
  const schemeNames = (practice.acceptedSchemes ?? []).map((s) => s.name).filter(Boolean);
  const displayName = (practice.tradingName || practice.name || '').trim();

  return (
    <section
      className={`rounded-2xl border border-[#dbe8e3] bg-white p-5 shadow-sm sm:p-6 ${className}`}
      aria-labelledby="clinic-inherited-settings-heading"
    >
      <h2 id="clinic-inherited-settings-heading" className="text-base font-semibold text-[#0E2340]">
        Inherited from your clinic
      </h2>
      <p className="mt-1 text-[13px] text-[#65758b]">
        Branding, locations, medical aid, billing, and booking rules come from your clinic administrator.
        You keep your own credentials and personal schedule view.
      </p>

      {practice.logoUrl ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#e1e7ef] bg-[#fafbfc] px-4 py-3">
          <img
            src={practice.logoUrl}
            alt=""
            className="h-12 w-12 rounded-lg border border-[#e1e7ef] bg-white object-contain p-1"
          />
          <div>
            <p className="text-sm font-semibold text-[#0E2340]">{displayName}</p>
            <p className="text-[12px] text-[#65758b]">Clinic letterhead & invoices</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Detail label="Practice name" value={displayName} />
        <Detail label="Timezone" value={practice.timezone} />
        <Detail label="BHF practice number" value={practice.bhfPracticeNumber || ''} />
        <Detail label="VAT number" value={billing.vatNumber || ''} />
        <Detail
          label="Primary location"
          value={
            primaryLocation
              ? [primaryLocation.name, primaryLocation.address].filter(Boolean).join(' · ')
              : ''
          }
        />
        <Detail
          label="Patient activation code"
          value={practice.clinicCode ? practice.clinicCode.toUpperCase() : ''}
        />
      </div>

      {bankingNote ? (
        <div className="mt-4 rounded-xl bg-[#f6f8fa] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
            Banking (invoices)
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#344256]">
            {bankingNote}
          </pre>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Detail
          label="Medical aid"
          value={
            practice.publicListing?.acceptsMedicalAid
              ? schemeNames.length
                ? schemeNames.join(', ')
                : 'Accepted — schemes configured by clinic'
              : 'Private / cash only'
          }
        />
        <Detail
          label="Visit types"
          value={
            (practice.consultTypes ?? []).length
              ? practice.consultTypes!.join(', ')
              : 'Set by clinic'
          }
        />
      </div>

      {bookingPolicy ? (
        <div className="mt-4 rounded-xl bg-[#f6f8fa] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
            Booking rules
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-[#344256]">
            <li>
              Patient cancellation window: {bookingPolicy.patientCancellationWindowHours} hours
            </li>
            <li>
              Clinician cancellation window: {bookingPolicy.doctorCancellationWindowHours} hours
            </li>
            <li>
              Confirmations:{' '}
              {bookingPolicy.confirmationMode === 'doctor_confirms'
                ? 'Clinician confirms'
                : 'Automatic'}
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
};
