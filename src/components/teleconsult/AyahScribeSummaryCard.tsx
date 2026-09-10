import { CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import React from 'react';
import type { ConsultScribeNote } from '../../lib/consultScribeNote';

type Props = {
  note: ConsultScribeNote;
  onApply: () => void;
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

export function AyahScribeSummaryCard({ note, onApply }: Props) {
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

          {note.summary ? (
            <p className="mt-4 text-[15px] font-medium leading-relaxed text-[#344256]">
              {note.summary}
            </p>
          ) : null}

          <div className="mt-4 space-y-4">
            <Section title="Subjective" body={note.subjective} />
            <Section title="Objective" body={note.objective} />
            <Section title="Assessment" body={note.assessment} />
            <Section title="Plan" body={note.plan} />
          </div>

          {note.followUps.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">
                Follow-ups
              </p>
              <ul className="mt-2 space-y-1.5">
                {note.followUps.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-[#344256]">
                    <span className="text-[#427160]">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onApply}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#427160] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365c4e]"
        >
          <CheckIcon className="h-4 w-4" />
          Use in clinical note
        </button>
      </div>
    </div>
  );
}
