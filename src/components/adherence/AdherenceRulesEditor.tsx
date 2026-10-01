import React, { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAdherenceRules } from '../../hooks/useAdherenceRules';
import {
  ADHERENCE_EVENT_PIPELINE,
  type AdherenceRulesConfig,
} from '../../lib/adherenceEventModel';

type Props = { canEdit?: boolean };

const NumberField: React.FC<{
  label: string;
  hint?: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}> = ({ label, hint, value, disabled, min, max, onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-gray-700">{label}</span>
    {hint && <span className="mb-1 block text-xs text-gray-500">{hint}</span>}
    <input
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
    />
  </label>
);

export const AdherenceRulesEditor: React.FC<Props> = ({ canEdit = true }) => {
  const { config, save, reset, saving, practiceId } = useAdherenceRules();
  const [draft, setDraft] = useState<AdherenceRulesConfig>(config);
  const [message, setMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setDraft(config);
  }, [config]);

  const patch = (partial: Partial<AdherenceRulesConfig>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  if (!practiceId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Join or create a practice to configure adherence thresholds.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#e4eaf2] bg-white p-5">
        <h3 className="font-heading text-lg font-semibold text-[#0E2340]">
          Adherence event model
        </h3>
        <p className="mt-1 text-sm text-[#72829B]">
          Prescribed doses become expected slots, then taken / reported (or late), or missed
          after your miss cutoff. Thresholds below drive Health Monitor bands and calendar colours.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ADHERENCE_EVENT_PIPELINE.map((step, i) => (
            <li
              key={step.stage}
              className="rounded-xl border border-[#eef2f6] bg-[#f8fafc] p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-anixi-green">
                {i + 1}. {step.title}
              </p>
              <p className="mt-1 text-xs text-gray-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-[#e4eaf2] bg-white p-5">
        <h4 className="mb-4 font-semibold text-[#0E2340]">Time windows</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Late window (minutes)"
            hint="Taken within this time after scheduled = on-time. Later = Late."
            value={draft.lateWindowMinutes}
            disabled={!canEdit}
            min={0}
            max={1440}
            onChange={(v) => patch({ lateWindowMinutes: v })}
          />
          <NumberField
            label="Miss cutoff (minutes)"
            hint="Untaken doses older than this are treated as Missed."
            value={draft.missCutoffMinutes}
            disabled={!canEdit}
            min={1}
            max={10080}
            onChange={(v) => patch({ missCutoffMinutes: v })}
          />
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.countLateAsTaken}
            disabled={!canEdit}
            onChange={(e) => patch({ countLateAsTaken: e.target.checked })}
          />
          <span>
            Count late doses as taken in adherence %
            <span className="block text-xs text-gray-500">
              Turn off to treat late doses like misses for rate math.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.excludeOpenPendingFromRate}
            disabled={!canEdit}
            onChange={(e) => patch({ excludeOpenPendingFromRate: e.target.checked })}
          />
          <span>
            Exclude open pending doses from adherence %
            <span className="block text-xs text-gray-500">
              Only taken + missed (including reclassified) count in the denominator.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-[#e4eaf2] bg-white p-5">
        <h4 className="mb-4 font-semibold text-[#0E2340]">Rate bands (%)</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Excellent at / above"
            value={draft.excellentMinPct}
            disabled={!canEdit}
            min={1}
            max={100}
            onChange={(v) => patch({ excellentMinPct: v })}
          />
          <NumberField
            label="Moderate at / above"
            value={draft.moderateMinPct}
            disabled={!canEdit}
            min={0}
            max={99}
            onChange={(v) => patch({ moderateMinPct: v })}
          />
          <NumberField
            label="Needs attention below"
            hint="Caregiver / attention filters"
            value={draft.attentionBelowPct}
            disabled={!canEdit}
            min={0}
            max={100}
            onChange={(v) => patch({ attentionBelowPct: v })}
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              save(draft);
              setMessage('Adherence thresholds saved for this practice.');
            }}
            className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save thresholds'}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = reset();
              setDraft(next);
              setMessage('Restored default adherence thresholds.');
            }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Reset to defaults
          </button>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-amber-800">
          View only — practice managers and administrators can edit these thresholds.
        </p>
      )}
    </div>
  );
};
