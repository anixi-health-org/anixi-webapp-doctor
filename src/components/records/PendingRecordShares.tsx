import React, { useState } from 'react';
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import {
  approveRecordShareRequest,
  declineRecordShareRequest,
  type PendingRecordShareRequest,
} from '../../services/medicalRecordShareService';
import {
  formatShareDurationLabel,
  selectedScopeLabels,
} from '../../services/medicalRecordShareAccess';

interface PendingRecordSharesProps {
  requests: PendingRecordShareRequest[];
  doctorId: string;
  onReviewed?: () => void;
}

const formatRequestedAt = (date: Date | null): string =>
  date
    ? date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'recently';

export const PendingRecordShares: React.FC<PendingRecordSharesProps> = ({
  requests,
  doctorId,
  onReviewed,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const review = async (
    shareId: string,
    action: 'approve' | 'decline'
  ): Promise<void> => {
    setError(null);
    setBusyId(shareId);
    try {
      if (action === 'approve') {
        await approveRecordShareRequest({ shareId, doctorId });
      } else {
        await declineRecordShareRequest({ shareId, doctorId });
      }
      onReviewed?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update the request.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-6 rounded-[12px] border border-[#f0d8a8] bg-[#fffaf0] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#a8760f]" />
        <h2 className="text-base font-semibold text-[#344256]">
          Record sharing requests
        </h2>
        <span className="rounded-full bg-[#a8760f] px-2 py-0.5 text-xs font-semibold text-white">
          {requests.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-[#65758b]">
        These patients want to share their medical records with you. You only see
        their records once you accept.
      </p>

      {error && (
        <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {requests.map((request) => {
          const categories = request.shareAll
            ? ['All medical records']
            : selectedScopeLabels(request.scope);
          const isBusy = busyId === request.shareId;

          return (
            <li
              key={request.shareId}
              className="rounded-[12px] border border-[#e1e7ef] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#344256]">
                    {request.patientName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[#94a3b8]">
                    <Clock3 className="h-3.5 w-3.5" />
                    Requested {formatRequestedAt(request.requestedAt)} ·{' '}
                    {formatShareDurationLabel(
                      request.durationPreset,
                      request.customDurationDays
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void review(request.shareId, 'approve')}
                    disabled={isBusy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#427160] px-3 text-sm font-medium text-white hover:bg-[#365c4f] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isBusy ? 'Working...' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(request.shareId, 'decline')}
                    disabled={isBusy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#65758b] hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Decline
                  </button>
                </div>
              </div>

              {request.patientMessage && (
                <p className="mt-3 rounded-[10px] bg-[#f7f9fb] p-3 text-sm text-[#344256]">
                  “{request.patientMessage}”
                </p>
              )}

              {categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {categories.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-[#eef4f1] px-2.5 py-1 text-xs font-medium text-[#427160]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
