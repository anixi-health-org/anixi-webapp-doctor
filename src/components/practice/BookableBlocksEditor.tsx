import React, { useEffect, useMemo, useState } from 'react';
import { BookableBlock, ConsultType, DayOfWeek } from '../../types';
import {
  createBookableBlock,
  deleteBookableBlock,
  syncDoctorPublicAvailability,
} from '../../services/practiceSettingsService';
import { useAuth } from '../../hooks/AuthContext';

const WEEKDAYS: { label: string; short: string; value: DayOfWeek }[] = [
  { label: 'Monday', short: 'Mon', value: 1 },
  { label: 'Tuesday', short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday', short: 'Thu', value: 4 },
  { label: 'Friday', short: 'Fri', value: 5 },
  { label: 'Saturday', short: 'Sat', value: 6 },
  { label: 'Sunday', short: 'Sun', value: 0 },
];

const VISIT_TYPES: { value: ConsultType; label: string }[] = [
  { value: 'initial', label: 'New patient' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'teleconsult', label: 'Video' },
  { value: 'other', label: 'Other' },
];

const APPOINTMENT_LENGTHS = [15, 20, 30, 45, 60];
const BREAK_OPTIONS = [0, 5, 10, 15];

type SessionPreset = 'morning' | 'afternoon' | 'evening' | 'fullday' | 'custom';

const SESSION_PRESETS: {
  id: SessionPreset;
  label: string;
  startTime: string;
  endTime: string;
}[] = [
  { id: 'morning', label: 'Morning', startTime: '08:00', endTime: '12:00' },
  { id: 'afternoon', label: 'Afternoon', startTime: '13:00', endTime: '17:00' },
  { id: 'evening', label: 'Evening', startTime: '17:00', endTime: '20:00' },
  { id: 'fullday', label: 'Full day', startTime: '08:00', endTime: '17:00' },
  { id: 'custom', label: 'Custom', startTime: '09:00', endTime: '13:00' },
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const chipBase =
  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition';
const chipOn = 'border-anixi-green bg-anixi-green text-white';
const chipOff = 'border-[#e1e7ef] bg-white text-[#65758b] hover:border-anixi-green/40';

const formatClock = (hhmm: string) => {
  const [hRaw, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(m)) return hhmm;
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
};

interface Props {
  practiceId: string;
  blocks: BookableBlock[];
  locations: { id: string; name: string }[];
  onChanged: () => void;
  /** When set, manage hours for this doctor (clinic admin). Defaults to signed-in user. */
  doctorId?: string;
}

export const BookableBlocksEditor: React.FC<Props> = ({
  practiceId,
  blocks,
  locations,
  onChanged,
  doctorId: doctorIdProp,
}) => {
  const { user } = useAuth();
  const doctorId = doctorIdProp || user?.id || '';
  const [showForm, setShowForm] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5]);
  const [preset, setPreset] = useState<SessionPreset>('morning');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [visitTypes, setVisitTypes] = useState<ConsultType[]>(['initial', 'follow-up']);
  const [appointmentLength, setAppointmentLength] = useState(30);
  const [breakBetween, setBreakBetween] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId && locations[0]?.id) {
      setLocationId(locations[0].id);
    }
  }, [locations, locationId]);

  // Backfill patient-facing availability from existing clinic hours.
  useEffect(() => {
    if (!practiceId || !doctorId) return;
    void syncDoctorPublicAvailability(practiceId, doctorId).catch((error) => {
      console.warn('[BookableBlocksEditor] availability sync failed:', error);
    });
  }, [practiceId, doctorId]);

  const activeBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.active !== false)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    [blocks]
  );

  const weeklyMap = useMemo(() => {
    const map: Record<DayOfWeek, BookableBlock[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    activeBlocks.forEach((b) => {
      map[b.dayOfWeek].push(b);
    });
    return map;
  }, [activeBlocks]);

  const applyPreset = (id: SessionPreset) => {
    setPreset(id);
    const found = SESSION_PRESETS.find((p) => p.id === id);
    if (!found || id === 'custom') return;
    setStartTime(found.startTime);
    setEndTime(found.endTime);
  };

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleVisitType = (ct: ConsultType) => {
    setVisitTypes((prev) =>
      prev.includes(ct) ? prev.filter((t) => t !== ct) : [...prev, ct]
    );
  };

  const resetForm = () => {
    setSelectedDays([1, 2, 3, 4, 5]);
    setPreset('morning');
    setStartTime('08:00');
    setEndTime('12:00');
    setLocationId(locations[0]?.id ?? '');
    setVisitTypes(['initial', 'follow-up']);
    setAppointmentLength(30);
    setBreakBetween(5);
    setShowMore(false);
    setError(null);
  };

  const openForm = () => {
    if (!locationId && locations[0]?.id) setLocationId(locations[0].id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!user?.id) {
      setError('You must be signed in to save clinic hours.');
      return;
    }
    if (selectedDays.length === 0) {
      setError('Select at least one day.');
      return;
    }
    if (!locationId) {
      setError('Add a location under Overview first.');
      return;
    }
    if (visitTypes.length === 0) {
      setError('Select at least one visit type.');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const dayOfWeek of selectedDays) {
        await createBookableBlock(practiceId, {
          practiceId,
          doctorId,
          dayOfWeek,
          startTime,
          endTime,
          locationId,
          allowedConsultTypes: visitTypes,
          slotDurationMinutes: appointmentLength,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: breakBetween,
          active: true,
        });
      }
      const dayNames = selectedDays.map((d) => DAY_LABELS[d]).join(', ');
      setSuccess(
        `Saved ${dayNames} · ${formatClock(startTime)} - ${formatClock(endTime)}.`
      );
      closeForm();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save clinic session.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!window.confirm('Remove this clinic session?')) return;
    await deleteBookableBlock(practiceId, blockId);
    setSuccess('Session removed.');
    onChanged();
  };

  const estimatedSlots = (() => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const total = eh * 60 + em - (sh * 60 + sm);
    const step = appointmentLength + breakBetween;
    if (total <= 0 || step <= 0) return 0;
    return Math.floor(total / step);
  })();

  const daysSummary =
    selectedDays.length === 0
      ? 'No days selected'
      : selectedDays.length === 5 &&
          [1, 2, 3, 4, 5].every((d) => selectedDays.includes(d as DayOfWeek))
        ? 'Weekdays'
        : selectedDays.length === 7
          ? 'Every day'
          : selectedDays.map((d) => DAY_LABELS[d].slice(0, 3)).join(', ');

  return (
    <div className="space-y-5">
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#0E2340]">Clinic hours</h3>
          <p className="mt-0.5 text-[13px] text-[#65758b]">
            When patients can book with you each week.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
          >
            + Add hours
          </button>
        )}
      </div>

      {/* Compact week strip - only when hours exist and form is closed */}
      {!showForm && activeBlocks.length > 0 && (
        <div className="grid grid-cols-7 gap-1.5 rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-2.5">
          {WEEKDAYS.map((day) => {
            const dayBlocks = weeklyMap[day.value];
            const hasHours = dayBlocks.length > 0;
            return (
              <div
                key={day.value}
                className={`rounded-lg px-1 py-2 text-center ${
                  hasHours ? 'bg-white shadow-sm ring-1 ring-[#e1e7ef]' : ''
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  {day.short}
                </p>
                {hasHours ? (
                  <div className="mt-1 space-y-0.5">
                    {dayBlocks.slice(0, 2).map((b) => (
                      <p key={b.id} className="text-[10px] font-medium leading-tight text-[#0E2340]">
                        {formatClock(b.startTime)}
                      </p>
                    ))}
                    {dayBlocks.length > 2 && (
                      <p className="text-[9px] text-[#8FA0B6]">+{dayBlocks.length - 2}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-[#c5cdd8]">-</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="space-y-4 rounded-xl border border-[#e1e7ef] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#0E2340]">New clinic session</p>
              <p className="mt-0.5 text-[12px] text-[#65758b]">
                Pick days and hours - defaults work for most clinics.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="text-[13px] font-medium text-[#65758b] hover:text-[#0E2340]"
            >
              Cancel
            </button>
          </div>

          {/* Days */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-[13px] font-semibold text-[#344256]">Days</label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  className="font-medium text-anixi-green hover:underline"
                >
                  Weekdays
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6, 0])}
                  className="font-medium text-anixi-green hover:underline"
                >
                  All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const active = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`${chipBase} min-w-[2.75rem] ${active ? chipOn : chipOff}`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-[#344256]">Hours</label>
            <div className="flex flex-wrap gap-1.5">
              {SESSION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`${chipBase} ${preset === p.id ? chipOn : chipOff}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
                  Start
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setPreset('custom');
                    setStartTime(e.target.value);
                  }}
                  className="h-10 w-full rounded-lg border border-[#e1e7ef] px-3 text-sm text-[#0E2340] outline-none focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/15"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
                  End
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setPreset('custom');
                    setEndTime(e.target.value);
                  }}
                  className="h-10 w-full rounded-lg border border-[#e1e7ef] px-3 text-sm text-[#0E2340] outline-none focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/15"
                />
              </div>
            </div>
          </div>

          {/* Visit length - always visible, one row */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-[#344256]">
              Appointment length
            </label>
            <div className="flex flex-wrap gap-1.5">
              {APPOINTMENT_LENGTHS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setAppointmentLength(mins)}
                  className={`${chipBase} ${
                    appointmentLength === mins ? chipOn : chipOff
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Location - only if more than one */}
          {locations.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              Add a location under Overview before saving hours.
            </p>
          ) : locations.length > 1 ? (
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-[#344256]">
                Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm text-[#0E2340] outline-none focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/15"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* More options - collapsed by default */}
          <div className="rounded-lg border border-[#eef2f6] bg-[#f8fafc]">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
            >
              <span className="text-[13px] font-medium text-[#344256]">
                More options
                <span className="ml-2 font-normal text-[#8FA0B6]">
                  breaks, visit types
                </span>
              </span>
              <span className="text-[12px] font-semibold text-anixi-green">
                {showMore ? 'Hide' : 'Show'}
              </span>
            </button>

            {showMore && (
              <div className="space-y-4 border-t border-[#eef2f6] px-3.5 py-3.5">
                <div>
                  <label className="mb-2 block text-[13px] font-medium text-[#344256]">
                    Break between patients
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BREAK_OPTIONS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setBreakBetween(mins)}
                        className={`${chipBase} ${
                          breakBetween === mins ? chipOn : chipOff
                        }`}
                      >
                        {mins === 0 ? 'None' : `${mins} min`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-medium text-[#344256]">
                    Visit types patients can book
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VISIT_TYPES.map((vt) => {
                      const active = visitTypes.includes(vt.value);
                      return (
                        <button
                          key={vt.value}
                          type="button"
                          onClick={() => toggleVisitType(vt.value)}
                          className={`${chipBase} ${active ? chipOn : chipOff}`}
                        >
                          {vt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[12px] leading-relaxed text-[#65758b]">
            {daysSummary} · {formatClock(startTime)} - {formatClock(endTime)} · {appointmentLength}
            -min visits
            {breakBetween > 0 ? ` · ${breakBetween}-min breaks` : ''} · ~{estimatedSlots} slots/day
          </p>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-10 items-center rounded-lg border border-[#e1e7ef] bg-white px-4 text-sm font-medium text-[#344256] hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || locations.length === 0}
              className="inline-flex h-10 items-center rounded-lg bg-anixi-green px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#365c4f] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Saved list */}
      {!showForm && (
        <div>
          {activeBlocks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e1e7ef] px-5 py-12 text-center">
              <p className="text-sm font-semibold text-[#0E2340]">No clinic hours yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-[#65758b]">
                Add a morning or afternoon session so patients can book.
              </p>
              <button
                type="button"
                onClick={openForm}
                className="mt-4 inline-flex h-10 items-center rounded-lg bg-anixi-green px-4 text-sm font-semibold text-white hover:bg-[#365c4f]"
              >
                + Add hours
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#eef2f6] rounded-xl border border-[#e1e7ef]">
              {activeBlocks.map((b) => {
                const loc = locations.find((l) => l.id === b.locationId);
                return (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0E2340]">
                        {DAY_LABELS[b.dayOfWeek]}{' '}
                        <span className="font-medium text-[#65758b]">
                          {formatClock(b.startTime)} - {formatClock(b.endTime)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[#8FA0B6]">
                        {b.slotDurationMinutes}-min · {loc?.name ?? 'Location'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(b.id)}
                      className="shrink-0 text-xs font-semibold text-[#65758b] hover:text-red-600"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
