import { CheckIcon, ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import type { ConsultScribeNote } from '../../lib/consultScribeNote';

type Props = {
  note: ConsultScribeNote;
  onApply: () => void;
  /** Detail-only view (patient chart / last encounter). */
  readOnly?: boolean;
  /** Raw call transcript, shown on request so the doctor can check what Ayah heard. */
  transcript?: string;
  onUsePrescription?: (text: string) => void;
  onUseReferral?: (text: string) => void;
};

function Section({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#344256]">{body}</p>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-[#344256]">
            <span className="text-[#427160]">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DraftBlock({
  title,
  body,
  actionLabel,
  onUse,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onUse?: (text: string) => void;
}) {
  if (!body.trim()) return null;
  return (
    <div className="rounded-lg border border-[#e1e7ef] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">{title}</p>
        {onUse ? (
          <button
            type="button"
            onClick={() => onUse(body)}
            className="rounded-lg border border-[#427160]/40 px-2.5 py-1 text-xs font-semibold text-[#427160] hover:bg-[#eef4f1]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#344256]">{body}</p>
    </div>
  );
}

export function AyahScribeSummaryCard({
  note,
  onApply,
  readOnly = false,
  transcript,
  onUsePrescription,
  onUseReferral,
}: Props) {
  const [showTranscript, setShowTranscript] = useState(false);
  return (
    <div className="rounded-xl border border-[#427160]/25 bg-gradient-to-b from-[#eef4f1] to-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#427160]/10">
              <SparklesIcon className="h-4 w-4 text-[#427160]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1c2731]">Ayah visit summary</p>
              <p className="text-xs text-[#65758b]">
                Generated from your teleconsult audio. Review before saving to the chart.
              </p>
            </div>
          </div>

          {note.redFlags.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Red flags raised in the call
              </p>
              <ul className="mt-1.5 space-y-1 text-sm text-amber-900">
                {note.redFlags.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {note.summary ? (
            <p className="mt-4 text-[15px] font-medium leading-relaxed text-[#344256]">
              {note.summary}
            </p>
          ) : null}

          <div className="mt-4 space-y-4">
            <Bullets title="Discussed in the visit" items={note.keyPoints} />
            <Section title="Subjective" body={note.subjective} />
            <Section title="Objective" body={note.objective} />
            <Section title="Assessment" body={note.assessment} />
            <Section title="Plan" body={note.plan} />
            <Bullets title="Follow-ups" items={note.followUps} />
            <Section title="Instructions for the patient" body={note.patientInstructions} />
            <DraftBlock
              title="Prescription draft from the call"
              body={note.prescriptionDraft}
              actionLabel="Use as prescription draft"
              onUse={readOnly ? undefined : onUsePrescription}
            />
            <DraftBlock
              title="Referral draft from the call"
              body={note.referralDraft}
              actionLabel="Use as referral letter"
              onUse={readOnly ? undefined : onUseReferral}
            />
          </div>

          {transcript?.trim() ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowTranscript((open) => !open)}
                className="text-xs font-semibold text-[#427160] underline"
              >
                {showTranscript ? 'Hide call transcript' : 'Show call transcript'}
              </button>
              {showTranscript ? (
                <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-[#65758b]">
                  {transcript}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {!readOnly ? (
          <button
            type="button"
            onClick={onApply}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#427160] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365c4e]"
          >
            <CheckIcon className="h-4 w-4" />
            Use in clinical note
          </button>
        ) : null}
      </div>
    </div>
  );
}
