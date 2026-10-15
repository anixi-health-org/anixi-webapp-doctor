import React from 'react';
import type { MedicalSchemeCatalogItem } from '../../types';

type Props = {
  schemes?: MedicalSchemeCatalogItem[];
  practiceName?: string;
  className?: string;
};

/** Read-only summary for clinic-employed doctors (schemes are set on the clinic practice). */
export const InheritedMedicalSchemesNotice: React.FC<Props> = ({
  schemes,
  practiceName,
  className = '',
}) => {
  const labels = (schemes ?? [])
    .map((row) => row.shortName?.trim() || row.name?.trim())
    .filter(Boolean);

  if (labels.length === 0) {
    return (
      <div
        className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
      >
        {practiceName ? (
          <p>
            <span className="font-medium">{practiceName}</span> has not published accepted medical
            schemes yet. Your clinic administrator can set them in clinic settings.
          </p>
        ) : (
          <p>Your clinic has not published accepted medical schemes yet.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#dbe8e3] bg-white px-4 py-3 ${className}`}
      role="status"
    >
      <p className="text-sm font-semibold text-[#0E2340]">Accepted medical schemes</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#65758b]">
        {practiceName ? (
          <>
            Set by <span className="font-medium text-[#344256]">{practiceName}</span>. You inherit
            this list for warrior matching and claims — you cannot edit it here.
          </>
        ) : (
          <>Set by your clinic. You inherit this list for warrior matching and claims.</>
        )}
      </p>
      <p className="mt-2 text-sm font-medium text-[#344256]">{labels.join(' · ')}</p>
    </div>
  );
};
