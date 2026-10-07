import React, { useState } from 'react';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useVitalRules } from '../../hooks/useVitalRules';
import {
  createCustomMetricRule,
  type VitalMetricRule,
} from '../../lib/vitalMetricRules';
import { VitalSeverityBadge } from './VitalSeverityBadge';
import { evaluateMetricValue } from '../../lib/vitalMetricRules';

type Props = {
  /** When false, form is read-only */
  canEdit?: boolean;
};

const BoundInput: React.FC<{
  label: string;
  value: number | null;
  disabled?: boolean;
  step?: string;
  onChange: (v: number | null) => void;
}> = ({ label, value, disabled, step = '1', onChange }) => (
  <label className="block text-xs text-gray-600">
    <span className="mb-1 block font-medium">{label}</span>
    <input
      type="number"
      step={step}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => {
        const t = e.target.value;
        onChange(t === '' ? null : Number(t));
      }}
      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-50"
    />
  </label>
);

function previewTone(rule: VitalMetricRule): 'normal' | 'warning' | 'urgent' | 'unknown' {
  const mid =
    rule.normalMin != null && rule.normalMax != null
      ? (rule.normalMin + rule.normalMax) / 2
      : rule.normalMin ?? rule.normalMax ?? 0;
  return evaluateMetricValue(rule, mid);
}

export const VitalRulesEditor: React.FC<Props> = ({ canEdit = true }) => {
  const { config, save, reset, saving, practiceId } = useVitalRules();
  const [draft, setDraft] = useState(config);
  const [message, setMessage] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  React.useEffect(() => {
    setDraft(config);
  }, [config]);

  const updateMetric = (key: string, patch: Partial<VitalMetricRule>) => {
    setDraft((prev) => ({
      ...prev,
      metrics: prev.metrics.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    }));
  };

  const handleSave = () => {
    save(draft);
    setMessage('Vital alert rules saved for this practice.');
  };

  const handleReset = () => {
    const next = reset();
    setDraft(next);
    setMessage('Restored default vital alert rules.');
  };

  const addCustom = () => {
    if (!customLabel.trim()) return;
    const rule = createCustomMetricRule(customLabel, customUnit);
    setDraft((prev) => ({
      ...prev,
      metrics: [...prev.metrics, rule],
    }));
    setCustomLabel('');
    setCustomUnit('');
  };

  const removeCustom = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      metrics: prev.metrics.filter((m) => m.key !== key),
    }));
  };

  if (!practiceId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Join or create a practice to configure vital alert rules.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#e4eaf2] bg-white p-5">
        <h3 className="font-heading text-lg font-semibold text-[#0E2340]">
          Vital alert rules
        </h3>
        <p className="mt-1 text-sm text-[#72829B]">
          Configure normal, warning, and urgent bands for BP, HR, SpO₂, temperature,
          glucose, and any custom metrics. Readings outside the warning band are marked
          urgent.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-amber-800">
            You can view these rules; only practice managers and administrators can edit them.
          </p>
        )}
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <ul className="space-y-4">
        {draft.metrics.map((metric) => (
          <li
            key={metric.key}
            className="rounded-2xl border border-[#e4eaf2] bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#0E2340]">{metric.label}</p>
                <span className="text-xs text-gray-500">{metric.unit}</span>
                <VitalSeverityBadge severity={previewTone(metric)} />
                {metric.isCustom && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    Custom
                  </span>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={metric.enabled}
                  disabled={!canEdit}
                  onChange={(e) => updateMetric(metric.key, { enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <BoundInput
                label="Normal min"
                value={metric.normalMin}
                disabled={!canEdit || !metric.enabled}
                step={metric.key === 'temperature' ? '0.1' : '1'}
                onChange={(v) => updateMetric(metric.key, { normalMin: v })}
              />
              <BoundInput
                label="Normal max"
                value={metric.normalMax}
                disabled={!canEdit || !metric.enabled}
                step={metric.key === 'temperature' ? '0.1' : '1'}
                onChange={(v) => updateMetric(metric.key, { normalMax: v })}
              />
              <BoundInput
                label="Warning min"
                value={metric.warningMin}
                disabled={!canEdit || !metric.enabled}
                step={metric.key === 'temperature' ? '0.1' : '1'}
                onChange={(v) => updateMetric(metric.key, { warningMin: v })}
              />
              <BoundInput
                label="Warning max"
                value={metric.warningMax}
                disabled={!canEdit || !metric.enabled}
                step={metric.key === 'temperature' ? '0.1' : '1'}
                onChange={(v) => updateMetric(metric.key, { warningMax: v })}
              />
            </div>
            {metric.isCustom && canEdit && (
              <button
                type="button"
                onClick={() => removeCustom(metric.key)}
                className="mt-3 text-sm font-medium text-red-600 hover:underline"
              >
                Remove metric
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-gray-800">Add custom metric</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-gray-600">
              <span className="mb-1 block font-medium">Label</span>
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Respiratory rate"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="w-full text-xs text-gray-600 sm:w-32">
              <span className="mb-1 block font-medium">Unit</span>
              <input
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="/min"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={addCustom}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-anixi-green px-4 py-2 text-sm font-semibold text-white"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save rules'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
};
