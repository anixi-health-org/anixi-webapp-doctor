import React, { useEffect, useMemo, useState } from 'react';
import {
  ensurePracticeBookingLocation,
  getResolvedConsultTypeSettings,
  replaceDoctorDayAvailability,
  syncDoctorPublicAvailability,
} from '../../services/practiceSettingsService';
import {
  listPracticeDailySchedules,
} from '../../services/practiceCalendarService';
import { generateRawSlots } from '../../services/schedulingService';
import { useAuth } from '../../hooks/AuthContext';
import {
  DAY_LABELS,
  DAY_SHORT,
  WEEKDAY_ORDER,
  formatClock,
  groupBlocksByDay,
  periodsFromBlocks,
  summarizeWeek,
  validateAvailabilityPeriods,
  type AvailabilityPeriod,
} from '../../lib/availabilitySchedule';
import { AvailabilityExceptionsEditor } from './AvailabilityExceptionsEditor';
import { ConsultTypeSettingsEditor } from './ConsultTypeSettingsEditor';
import {
  CLINIC_CONSULT_TYPES,
  VIDEO_CONSULT_TYPE,
} from '../../lib/consultTypeSettings';
import type {
  BookableBlock,
  ConsultType,
  ConsultTypeSetting,
  DayOfWeek,
  PracticeDailySchedule,
} from '../../types';

function enabledConsultTypes(
  settings: ConsultTypeSetting[],
  fallback?: ConsultType[] | null,
): ConsultType[] {
  const fromSettings = settings.filter((s) => s.enabled).map((s) => s.type);
  if (fromSettings.length > 0) return fromSettings;
  if (fallback && fallback.length > 0) return fallback;
  return ['initial', 'follow-up'];
}

function legacyBlockTiming(settings: ConsultTypeSetting[]): {
  slotDurationMinutes: number;
  bufferAfterMinutes: number;
} {
  const enabled = settings.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return { slotDurationMinutes: 30, bufferAfterMinutes: 5 };
  }
  const primary =
    enabled.find((s) => s.type === 'follow-up') ??
    enabled.find((s) => s.type === VIDEO_CONSULT_TYPE) ??
    enabled[0];
  return {
    slotDurationMinutes: primary.durationMinutes,
    bufferAfterMinutes: primary.bufferMinutes,
  };
}

function appointmentTypeSummary(settings: ConsultTypeSetting[]): string {
  const parts: string[] = [];
  const clinic = settings.find(
    (s) => s.enabled && CLINIC_CONSULT_TYPES.includes(s.type),
  );
  const video = settings.find((s) => s.enabled && s.type === VIDEO_CONSULT_TYPE);
  if (clinic) {
    parts.push(`Clinic ${clinic.durationMinutes} min`);
  }
  if (video) {
    parts.push(`Video ${video.durationMinutes} min`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No appointment types enabled yet';
}

const PREVIEW_MODES: { id: 'clinic' | 'video'; label: string }[] = [
  { id: 'clinic', label: 'Clinic visits' },
  { id: 'video', label: 'Video consultation' },
];

const PRESETS: { label: string; periods: AvailabilityPeriod[] }[] = [
  { label: 'Morning', periods: [{ startTime: '08:00', endTime: '12:00' }] },
  { label: 'Afternoon', periods: [{ startTime: '13:00', endTime: '17:00' }] },
  {
    label: 'Full day',
    periods: [{ startTime: '08:00', endTime: '17:00' }],
  },
  {
    label: 'Split shift',
    periods: [
      { startTime: '08:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '17:00' },
    ],
  },
];

const chipBase =
  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition';
const chipOn = 'border-anixi-green bg-anixi-green text-white';
const chipOff = 'border-[#e1e7ef] bg-white text-[#65758b] hover:border-anixi-green/40';

interface Props {
  practiceId: string;
  blocks: BookableBlock[];
  locations: { id: string; name: string }[];
  timezone?: string;
  practiceConsultTypes?: ConsultType[];
  onChanged: () => void;
  onPracticeUpdated?: () => void;
  doctorId?: string;
  /** Clinic-employed clinicians view admin-assigned hours only. */
  readOnly?: boolean;
}

export const BookableBlocksEditor: React.FC<Props> = ({
  practiceId,
  blocks,
  locations,
  timezone = 'Africa/Johannesburg',
  practiceConsultTypes,
  onChanged,
  onPracticeUpdated,
  doctorId: doctorIdProp,
  readOnly = false,
}) => {
  const { user } = useAuth();
  const doctorId = doctorIdProp || user?.id || '';

  const doctorBlocks = useMemo(
    () => blocks.filter((b) => b.doctorId === doctorId && b.active !== false),
    [blocks, doctorId],
  );
  const byDay = useMemo(() => groupBlocksByDay(doctorBlocks), [doctorBlocks]);

  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null);
  const [draftPeriods, setDraftPeriods] = useState<AvailabilityPeriod[]>([]);
  const [copyTargets, setCopyTargets] = useState<DayOfWeek[]>([]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [previewDate, setPreviewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    return d.toISOString().slice(0, 10);
  });
  const [exceptions, setExceptions] = useState<PracticeDailySchedule[]>([]);
  const [typeSettings, setTypeSettings] = useState<ConsultTypeSetting[]>([]);
  const [previewConsultType, setPreviewConsultType] =
    useState<ConsultType>('follow-up');

  useEffect(() => {
    if (!locationId && locations[0]?.id) setLocationId(locations[0].id);
  }, [locations, locationId]);

  useEffect(() => {
    if (readOnly || !practiceId || !doctorId) return;
    void syncDoctorPublicAvailability(practiceId, doctorId).catch((err) => {
      console.warn('[Availability] sync failed:', err);
    });
  }, [readOnly, practiceId, doctorId]);

  useEffect(() => {
    void listPracticeDailySchedules(practiceId)
      .then(setExceptions)
      .catch(() => setExceptions([]));
  }, [practiceId]);

  useEffect(() => {
    void getResolvedConsultTypeSettings(practiceId)
      .then((settings) => {
        setTypeSettings(settings);
        const firstEnabled = settings.find((s) => s.enabled);
        if (firstEnabled) setPreviewConsultType(firstEnabled.type);
      })
      .catch(() => setTypeSettings([]));
  }, [practiceId]);

  const openEditDay = (day: DayOfWeek) => {
    const periods = periodsFromBlocks(byDay[day]);
    setDraftPeriods(
      periods.length > 0 ? periods : [{ startTime: '08:00', endTime: '12:00' }],
    );
    setCopyTargets([]);
    setEditingDay(day);
    setError(null);
  };

  const openAddAvailability = () => {
    const emptyDay = WEEKDAY_ORDER.find((d) => byDay[d].length === 0) ?? 1;
    openEditDay(emptyDay);
  };

  const updatePeriod = (
    index: number,
    key: keyof AvailabilityPeriod,
    value: string,
  ) => {
    setDraftPeriods((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    );
  };

  const saveDay = async (clearDay = false) => {
    if (!doctorId) {
      setError('You must be signed in to save availability.');
      return;
    }

    const activeVisitTypes = enabledConsultTypes(typeSettings, practiceConsultTypes);
    if (!clearDay && activeVisitTypes.length === 0) {
      setError('Turn on at least one appointment type below before saving hours.');
      return;
    }

    const { slotDurationMinutes, bufferAfterMinutes } = legacyBlockTiming(typeSettings);

    const periods = clearDay ? [] : draftPeriods;
    if (!clearDay) {
      const validation = validateAvailabilityPeriods(periods);
      if (!validation.ok) {
        setError(validation.error);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { locationId: resolvedLocationId, created } =
        await ensurePracticeBookingLocation(practiceId, typeSettings);
      setLocationId(resolvedLocationId);
      if (created) {
        onPracticeUpdated?.();
      }

      const daysToWrite: DayOfWeek[] =
        editingDay == null
          ? []
          : [editingDay, ...copyTargets.filter((d) => d !== editingDay)];

      for (const day of daysToWrite) {
        await replaceDoctorDayAvailability({
          practiceId,
          doctorId,
          dayOfWeek: day,
          periods,
          locationId: resolvedLocationId,
          allowedConsultTypes: activeVisitTypes,
          slotDurationMinutes,
          bufferAfterMinutes,
        });
      }

      setSuccess(
        clearDay
          ? `${DAY_LABELS[editingDay!]} marked unavailable.`
          : `Availability saved for ${daysToWrite.map((d) => DAY_LABELS[d]).join(', ')}.${
              created ? ' A default location was added for you.' : ''
            }`,
      );
      setEditingDay(null);
      onChanged();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't save your availability.",
      );
    } finally {
      setSaving(false);
    }
  };

  const previewDateObj = useMemo(() => {
    const [y, m, d] = previewDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [previewDate]);

  const previewException = useMemo(
    () => exceptions.find((e) => e.date === previewDate) ?? null,
    [exceptions, previewDate],
  );

  const previewSlots = useMemo(
    () =>
      generateRawSlots(previewDateObj, doctorBlocks, previewException, {
        consultType: previewConsultType,
        typeSettings,
        legacyEnabledTypes: practiceConsultTypes,
      }),
    [
      previewDateObj,
      doctorBlocks,
      previewException,
      previewConsultType,
      typeSettings,
      practiceConsultTypes,
    ],
  );

  const weekSummary = summarizeWeek(byDay);
  const typeSummary = appointmentTypeSummary(typeSettings);

  const syncTypeSettings = () => {
    void getResolvedConsultTypeSettings(practiceId)
      .then((settings) => {
        setTypeSettings(settings);
        const firstEnabled = settings.find((s) => s.enabled);
        if (firstEnabled) setPreviewConsultType(firstEnabled.type);
      })
      .catch(() => undefined);
    onChanged();
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
          {success}
        </div>
      )}
      {error && editingDay == null && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
          <button
            type="button"
            className="ml-2 font-semibold underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[17px] font-semibold text-[#0E2340]">
            {readOnly ? 'Your clinic hours' : 'Your hours'}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[#65758b]">
            {readOnly
              ? 'Hours assigned by your clinic administrator. Patients book within these windows.'
              : 'Set when patients can book clinic visits and video consults.'}
          </p>
          <p className="mt-2 text-[12px] font-medium text-[#8FA0B6]">
            Timezone: {timezone}
          </p>
        </div>
        {!readOnly && editingDay == null && (
          <button
            type="button"
            onClick={openAddAvailability}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
          >
            + Add availability
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
          Your booking schedule
        </p>
        <p className="mt-1.5 text-sm font-medium text-[#0E2340]">{weekSummary}</p>
        <p className="mt-2 text-[12px] text-[#65758b]">
          Appointment types: {typeSummary}
        </p>
      </div>

      {/* Weekly schedule */}
      {editingDay == null ? (
        <section className="overflow-hidden rounded-xl border border-[#e1e7ef]">
          {WEEKDAY_ORDER.map((day, index) => {
            const dayBlocks = byDay[day];
            const available = dayBlocks.length > 0;
            return (
              <div
                key={day}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  index > 0 ? 'border-t border-[#eef2f6]' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0E2340]">{DAY_LABELS[day]}</p>
                  {available ? (
                    <p className="mt-0.5 text-[12px] text-[#4d675c]">
                      {dayBlocks
                        .map((b) => `${formatClock(b.startTime)}-${formatClock(b.endTime)}`)
                        .join(' · ')}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-[#94a3b8]">
                      Unavailable, no bookings
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => openEditDay(day)}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-anixi-green hover:bg-[#eef4f1]"
                  >
                    {available ? 'Edit' : 'Add hours'}
                  </button>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="space-y-4 rounded-xl border border-[#e1e7ef] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#0E2340]">
                {DAY_LABELS[editingDay]} availability
              </p>
              <p className="mt-0.5 text-[12px] text-[#65758b]">
                Set one or more periods. Presets are shortcuts only, saved times are exact.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingDay(null)}
              className="text-[13px] font-medium text-[#65758b] hover:text-[#0E2340]"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDraftPeriods(preset.periods.map((p) => ({ ...p })))}
                className={`${chipBase} ${chipOff}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-[#344256]">
              Availability periods
            </p>
            {draftPeriods.map((period, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
                    Start
                  </label>
                  <input
                    type="time"
                    value={period.startTime}
                    onChange={(e) => updatePeriod(index, 'startTime', e.target.value)}
                    className="h-10 rounded-lg border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/15"
                  />
                </div>
                <span className="pb-2.5 text-[#8FA0B6]">→</span>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
                    End
                  </label>
                  <input
                    type="time"
                    value={period.endTime}
                    onChange={(e) => updatePeriod(index, 'endTime', e.target.value)}
                    className="h-10 rounded-lg border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/15"
                  />
                </div>
                {draftPeriods.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraftPeriods((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="mb-0.5 text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraftPeriods((prev) => [
                  ...prev,
                  { startTime: '14:00', endTime: '17:00' },
                ])
              }
              className="text-[13px] font-semibold text-anixi-green hover:underline"
            >
              + Add another period
            </button>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#344256]">
              Copy this schedule to…
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_ORDER.filter((d) => d !== editingDay).map((day) => {
                const active = copyTargets.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setCopyTargets((prev) =>
                        active ? prev.filter((d) => d !== day) : [...prev, day],
                      )
                    }
                    className={`${chipBase} ${active ? chipOn : chipOff}`}
                  >
                    {DAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
          </div>

          {locations.length > 1 && (
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#344256]">
                Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {locations.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
              No location is set up yet. Click <span className="font-semibold">Save</span> and
              we&apos;ll add a default one automatically, or add your own under{' '}
              <span className="font-semibold">Overview → Locations</span>.
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => void saveDay(true)}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Mark unavailable
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                className="inline-flex h-10 items-center rounded-lg border border-[#e1e7ef] bg-white px-4 text-sm font-medium text-[#344256]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveDay(false)}
                disabled={saving}
                className="inline-flex h-10 items-center rounded-lg bg-anixi-green px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#365c4f] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Progressive disclosure */}
      <div className="rounded-xl border border-[#e1e7ef]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-[#0E2340]">
              {readOnly ? 'Booking preview' : 'Appointment settings'}
            </p>
            <p className="text-[12px] text-[#65758b]">
              {readOnly
                ? 'See the slots patients can book on a given day'
                : 'What patients can book, days off, and a booking preview'}
            </p>
          </div>
          <span className="text-[12px] font-semibold text-anixi-green">
            {showAdvanced ? 'Hide' : 'Show'}
          </span>
        </button>

        {showAdvanced && (
          <div className="space-y-6 border-t border-[#eef2f6] px-4 py-4">
            {!readOnly && (
              <>
                <ConsultTypeSettingsEditor
                  practiceId={practiceId}
                  onChanged={syncTypeSettings}
                />

                <AvailabilityExceptionsEditor
                  practiceId={practiceId}
                  exceptions={exceptions}
                  onChanged={() => {
                    void listPracticeDailySchedules(practiceId).then(setExceptions);
                  }}
                />
              </>
            )}

            {readOnly && (
              <p className="text-[13px] text-[#65758b]">
                Appointment types: {typeSummary}
              </p>
            )}

            <section className="space-y-3">
              <h4 className="text-[13px] font-semibold text-[#344256]">
                Preview patient booking times
              </h4>
              <p className="text-[12px] text-[#65758b]">
                Check the slots patients will see before you go live.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PREVIEW_MODES.map((mode) => {
                  const setting = typeSettings.find(
                    (s) =>
                      s.enabled &&
                      (mode.id === 'video'
                        ? s.type === VIDEO_CONSULT_TYPE
                        : s.type === 'follow-up' || s.type === 'initial'),
                  );
                  if (!setting) return null;
                  const previewType =
                    mode.id === 'video' ? VIDEO_CONSULT_TYPE : setting.type;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPreviewConsultType(previewType)}
                      className={`${chipBase} ${
                        (mode.id === 'video'
                          ? previewConsultType === VIDEO_CONSULT_TYPE
                          : CLINIC_CONSULT_TYPES.includes(previewConsultType))
                          ? chipOn
                          : chipOff
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="h-10 rounded-lg border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green"
              />
              {previewException?.availability === 'closed' ? (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-slate-600">
                  Unavailable all day
                  {previewException.note ? ` · ${previewException.note}` : ''}
                </p>
              ) : previewSlots.length === 0 ? (
                <p className="text-[13px] text-[#94a3b8]">
                  No bookable slots for this date.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {previewSlots.map((slot) => (
                    <span
                      key={slot.startAt.toISOString()}
                      className="rounded-md border border-[#e1e7ef] bg-white px-2.5 py-1 text-[12px] font-medium text-[#0E2340]"
                    >
                      {slot.startAt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
