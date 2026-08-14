import React, { useEffect, useMemo, useState } from 'react';
import type { ConsultType, ConsultTypeSetting } from '../../types';
import {
  getResolvedConsultTypeSettings,
  setConsultTypeEnabled,
  upsertConsultTypeSetting,
} from '../../services/practiceSettingsService';
import { CONSULT_TYPE_CATALOG } from '../../lib/consultTypeSettings';

const DURATIONS = [15, 20, 30, 45, 60, 90];
const BUFFERS = [0, 5, 10, 15];

interface Props {
  practiceId: string;
  onChanged?: () => void;
}

export const ConsultTypeSettingsEditor: React.FC<Props> = ({
  practiceId,
  onChanged,
}) => {
  const [settings, setSettings] = useState<ConsultTypeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<ConsultType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ConsultType | null>(null);
  const [draft, setDraft] = useState<ConsultTypeSetting | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getResolvedConsultTypeSettings(practiceId);
      setSettings(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load appointment types.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [practiceId]);

  const enabledCount = useMemo(
    () => settings.filter((s) => s.enabled).length,
    [settings],
  );

  const beginEdit = (setting: ConsultTypeSetting) => {
    setEditing(setting.type);
    setDraft({ ...setting });
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSavingType(draft.type);
    setError(null);
    try {
      await upsertConsultTypeSetting(practiceId, draft);
      await reload();
      cancelEdit();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save appointment type.',
      );
    } finally {
      setSavingType(null);
    }
  };

  const toggleEnabled = async (setting: ConsultTypeSetting) => {
    setSavingType(setting.type);
    setError(null);
    try {
      await setConsultTypeEnabled(practiceId, setting.type, !setting.enabled);
      await reload();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update appointment type.',
      );
    } finally {
      setSavingType(null);
    }
  };

  if (loading) {
    return (
      <p className="text-[13px] text-[#94a3b8]">Loading appointment types…</p>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold text-[#344256]">
          Appointment types
        </h4>
        <p className="mt-1 text-[12px] text-[#65758b]">
          These control what patients can book and how long each visit takes.
          Availability still comes from your weekly schedule.
          {enabledCount > 0 ? ` ${enabledCount} enabled.` : ''}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {settings.map((setting) => {
          const isEditing = editing === setting.type;
          const catalog = CONSULT_TYPE_CATALOG[setting.type];
          return (
            <div
              key={setting.type}
              className={`rounded-xl border px-3 py-3 ${
                setting.enabled
                  ? 'border-[#e1e7ef] bg-white'
                  : 'border-[#eef2f6] bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0E2340]">
                    {setting.name || catalog.name}
                  </p>
                  <p className="text-[12px] text-[#65758b]">
                    {setting.enabled
                      ? `${setting.durationMinutes} min · ${setting.bufferMinutes} min buffer`
                      : 'Disabled — patients cannot book this type'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingType === setting.type}
                    onClick={() => void toggleEnabled(setting)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      setting.enabled
                        ? 'border-anixi-green text-anixi-green'
                        : 'border-[#cbd5e1] text-[#64748b]'
                    }`}
                  >
                    {setting.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      isEditing ? cancelEdit() : beginEdit(setting)
                    }
                    className="rounded-lg border border-[#e1e7ef] px-2.5 py-1 text-[11px] font-semibold text-[#344256]"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              {isEditing && draft && (
                <div className="mt-3 space-y-3 border-t border-[#eef2f6] pt-3">
                  <label className="block text-[12px] font-semibold text-[#344256]">
                    Name
                    <input
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green"
                    />
                  </label>
                  <label className="block text-[12px] font-semibold text-[#344256]">
                    Description
                    <input
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green"
                    />
                  </label>
                  <div>
                    <p className="mb-1.5 text-[12px] font-semibold text-[#344256]">
                      Duration
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATIONS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, durationMinutes: mins })
                          }
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                            draft.durationMinutes === mins
                              ? 'border-anixi-green bg-anixi-green text-white'
                              : 'border-[#e1e7ef] bg-white text-[#65758b]'
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[12px] font-semibold text-[#344256]">
                      Buffer after visit
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {BUFFERS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, bufferMinutes: mins })
                          }
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                            draft.bufferMinutes === mins
                              ? 'border-anixi-green bg-anixi-green text-white'
                              : 'border-[#e1e7ef] bg-white text-[#65758b]'
                          }`}
                        >
                          {mins === 0 ? 'None' : `${mins} min`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={savingType === draft.type}
                    onClick={() => void saveEdit()}
                    className="inline-flex h-9 items-center rounded-lg bg-anixi-green px-3.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingType === draft.type ? 'Saving…' : 'Save type'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
