import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Video } from 'lucide-react';
import type { ConsultType, ConsultTypeSetting } from '../../types';
import {
  getResolvedConsultTypeSettings,
  setConsultTypeEnabled,
  upsertConsultTypeSetting,
} from '../../services/practiceSettingsService';
import {
  CLINIC_CONSULT_TYPES,
  VIDEO_CONSULT_TYPE,
} from '../../lib/consultTypeSettings';

const DURATIONS = [15, 20, 30, 45, 60];
const BUFFERS = [0, 5, 10, 15];

type VisitMode = 'clinic' | 'video';

interface Props {
  practiceId: string;
  onChanged?: () => void;
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-anixi-green' : 'bg-[#cbd5e1]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export const ConsultTypeSettingsEditor: React.FC<Props> = ({
  practiceId,
  onChanged,
}) => {
  const [settings, setSettings] = useState<ConsultTypeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState<VisitMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
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
  }, [practiceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const clinicSettings = useMemo(
    () => settings.filter((s) => CLINIC_CONSULT_TYPES.includes(s.type)),
    [settings],
  );
  const videoSetting = settings.find((s) => s.type === VIDEO_CONSULT_TYPE);
  const clinicEnabled = clinicSettings.some((s) => s.enabled);
  const videoEnabled = Boolean(videoSetting?.enabled);
  const clinicDuration =
    clinicSettings.find((s) => s.type === 'follow-up')?.durationMinutes ??
    clinicSettings.find((s) => s.enabled)?.durationMinutes ??
    30;
  const clinicBuffer =
    clinicSettings.find((s) => s.type === 'follow-up')?.bufferMinutes ??
    clinicSettings.find((s) => s.enabled)?.bufferMinutes ??
    5;

  const persistClinicTiming = async (durationMinutes: number, bufferMinutes: number) => {
    setSavingMode('clinic');
    setError(null);
    try {
      const followUp = clinicSettings.find((s) => s.type === 'follow-up');
      const initial = clinicSettings.find((s) => s.type === 'initial');
      if (followUp) {
        await upsertConsultTypeSetting(practiceId, {
          ...followUp,
          durationMinutes,
          bufferMinutes,
        });
      }
      if (initial) {
        await upsertConsultTypeSetting(practiceId, {
          ...initial,
          durationMinutes,
          bufferMinutes,
        });
      }
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save clinic visits.');
    } finally {
      setSavingMode(null);
    }
  };

  const persistVideoTiming = async (durationMinutes: number, bufferMinutes: number) => {
    if (!videoSetting) return;
    setSavingMode('video');
    setError(null);
    try {
      await upsertConsultTypeSetting(practiceId, {
        ...videoSetting,
        durationMinutes,
        bufferMinutes,
      });
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save video consultation.');
    } finally {
      setSavingMode(null);
    }
  };

  const toggleMode = async (mode: VisitMode) => {
    const turningOffClinic = mode === 'clinic' && clinicEnabled;
    const turningOffVideo = mode === 'video' && videoEnabled;
    if (turningOffClinic && !videoEnabled) {
      setError('Keep at least one appointment type turned on.');
      return;
    }
    if (turningOffVideo && !clinicEnabled) {
      setError('Keep at least one appointment type turned on.');
      return;
    }

    setSavingMode(mode);
    setError(null);
    try {
      if (mode === 'video' && videoSetting) {
        await setConsultTypeEnabled(practiceId, VIDEO_CONSULT_TYPE, !videoEnabled);
      } else {
        const enable = !clinicEnabled;
        const typesToTouch: ConsultType[] = enable
          ? ['initial', 'follow-up']
          : CLINIC_CONSULT_TYPES;
        for (const type of typesToTouch) {
          await setConsultTypeEnabled(practiceId, type, enable);
        }
        if (enable) {
          for (const type of CLINIC_CONSULT_TYPES.filter(
            (t) => t !== 'initial' && t !== 'follow-up',
          )) {
            await setConsultTypeEnabled(practiceId, type, false);
          }
        }
      }
      await reload();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update appointment type.',
      );
    } finally {
      setSavingMode(null);
    }
  };

  if (loading) {
    return <p className="text-[13px] text-[#94a3b8]">Loading appointment types…</p>;
  }

  const chipBase =
    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50';
  const chipOn = 'border-anixi-green bg-anixi-green text-white';
  const chipOff = 'border-[#e1e7ef] bg-white text-[#65758b] hover:border-anixi-green/40';

  const rows: {
    mode: VisitMode;
    title: string;
    description: string;
    icon: React.ElementType;
    enabled: boolean;
    duration: number;
    buffer: number;
    onDuration: (mins: number) => void;
    onBuffer: (mins: number) => void;
  }[] = [
    {
      mode: 'clinic',
      title: 'Clinic visits',
      description: 'In-person appointments at your practice.',
      icon: Building2,
      enabled: clinicEnabled,
      duration: clinicDuration,
      buffer: clinicBuffer,
      onDuration: (mins) => void persistClinicTiming(mins, clinicBuffer),
      onBuffer: (mins) => void persistClinicTiming(clinicDuration, mins),
    },
    {
      mode: 'video',
      title: 'Video consultation',
      description: 'Remote video appointments with patients.',
      icon: Video,
      enabled: videoEnabled,
      duration: videoSetting?.durationMinutes ?? 20,
      buffer: videoSetting?.bufferMinutes ?? 5,
      onDuration: (mins) =>
        void persistVideoTiming(mins, videoSetting?.bufferMinutes ?? 5),
      onBuffer: (mins) =>
        void persistVideoTiming(videoSetting?.durationMinutes ?? 20, mins),
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold text-[#344256]">What patients can book</h4>
        <p className="mt-1 text-[12px] leading-relaxed text-[#65758b]">
          Turn each visit type on or off and choose how long it takes. Your weekly hours above
          control <span className="font-medium text-[#344256]">when</span> patients can book.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const isSaving = savingMode === row.mode;

          return (
            <div
              key={row.mode}
              className={`rounded-xl border px-4 py-4 ${
                row.enabled ? 'border-[#e1e7ef] bg-white' : 'border-[#eef2f6] bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                      row.enabled ? 'bg-[#eef4f1] text-anixi-green' : 'bg-white text-[#94a3b8]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0E2340]">{row.title}</p>
                    <p className="mt-0.5 text-[12px] text-[#65758b]">{row.description}</p>
                  </div>
                </div>
                <Toggle
                  checked={row.enabled}
                  disabled={isSaving}
                  label={`${row.enabled ? 'Disable' : 'Enable'} ${row.title}`}
                  onChange={() => void toggleMode(row.mode)}
                />
              </div>

              {row.enabled ? (
                <div className="mt-4 space-y-3 border-t border-[#eef2f6] pt-4">
                  <div>
                    <p className="mb-2 text-[12px] font-semibold text-[#344256]">
                      Appointment length
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATIONS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          disabled={isSaving}
                          onClick={() => row.onDuration(mins)}
                          className={`${chipBase} ${
                            row.duration === mins ? chipOn : chipOff
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-semibold text-[#344256]">
                      Break between patients
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {BUFFERS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          disabled={isSaving}
                          onClick={() => row.onBuffer(mins)}
                          className={`${chipBase} ${
                            row.buffer === mins ? chipOn : chipOff
                          }`}
                        >
                          {mins === 0 ? 'None' : `${mins} min`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isSaving && (
                    <p className="text-[11px] font-medium text-[#8FA0B6]">Saving…</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-[#94a3b8]">
                  Turn this on to let patients book {row.title.toLowerCase()}.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
