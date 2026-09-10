import { CheckIcon, XCircleIcon } from '@heroicons/react/24/outline';
import React from 'react';
import type { DoctorAgentDraft } from '../../services/askAnixiService';

type Props = {
  drafts: DoctorAgentDraft[];
  onResolve: (draft: DoctorAgentDraft, decision: 'approved' | 'rejected') => void;
};

function draftLabel(type: string): string {
  return type.replace(/_/g, ' ');
}

function approveLabel(type: string): string {
  if (type === 'message_reply') return 'Approve & send';
  return 'Approve';
}

export function AyahDraftReview({ drafts, onResolve }: Props) {
  if (drafts.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
        For your review
      </p>
      {drafts.slice(0, 3).map((draft) => (
        <article key={draft.id} className="rounded-xl bg-[#fff8eb] px-3 py-3 ring-1 ring-amber-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            AI-generated draft · {draftLabel(draft.type)}
          </p>
          <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[#5b4a2a]">
            {draft.preview || 'Draft is ready. Open it before anything is saved or sent.'}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-[#427160] px-2.5 py-1 text-xs font-semibold text-white"
              onClick={() => onResolve(draft, 'approved')}
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {approveLabel(draft.type)}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#65758b] ring-1 ring-[#e1e7ef]"
              onClick={() => onResolve(draft, 'rejected')}
            >
              <XCircleIcon className="h-3.5 w-3.5" />
              Discard
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
