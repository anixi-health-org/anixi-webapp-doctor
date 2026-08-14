import React, { useState } from 'react';
import type { PracticeDailySchedule } from '../../types';
import {
  deletePracticeDailySchedule,
  setPracticeDailySchedule,
} from '../../services/practiceCalendarService';

const REASON_PRESETS = [
  'Annual leave',
  'Public holiday',
  'Conference',
  'Training',
  'Personal appointment',
  'Clinic closure',
];

interface Props {
  practiceId: string;
  exceptions: PracticeDailySchedule[];
  onChanged: () => void;
}

export const AvailabilityExceptionsEditor: React.FC<Props> = ({
  practiceId,
  exceptions,
  onChanged,
}) => {
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'closed' | 'limited'>('closed');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('13:00');
  const [note, setNote] = useState('Annual leave');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upcoming = [...exceptions]
    .filter((e) => e.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleSave = async () => {
    if (!date) {
      setError('Choose a date.');
      return;
    }
    if (mode === 'limited' && openTime >= closeTime) {
      setError('Reduced hours must end after they start.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setPracticeDailySchedule({
        practiceId,
        date,
        availability: mode,
        ...(mode === 'limited'
          ? { openTime, closeTime }
          : { openTime: undefined, closeTime: undefined }),
        note: note.trim() || undefined,
      });
      setDate('');
      onChanged();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Couldn't save this exception.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exceptionDate: string) => {
    await deletePracticeDailySchedule(practiceId, exceptionDate);
    onChanged();
  };

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold text-[#344256]">Exceptions</h4>
        <p className="mt-0.5 text-[12px] text-[#65758b]">
          One-off changes that do not modify your recurring weekly schedule.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
              Reason
            </label>
            <select
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green"
            >
              {REASON_PRESETS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('closed')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              mode === 'closed'
                ? 'border-anixi-green bg-anixi-green text-white'
                : 'border-[#e1e7ef] bg-white text-[#65758b]'
            }`}
          >
            Unavailable all day
          </button>
          <button
            type="button"
            onClick={() => setMode('limited')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              mode === 'limited'
                ? 'border-anixi-green bg-anixi-green text-white'
                : 'border-[#e1e7ef] bg-white text-[#65758b]'
            }`}
          >
            Reduced hours
          </button>
        </div>

        {mode === 'limited' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
                Open
              </label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#8FA0B6]">
                Close
              </label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-[12px] text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-lg bg-anixi-green px-3.5 text-xs font-semibold text-white hover:bg-[#365c4f] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add exception'}
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-[12px] text-[#94a3b8]">No upcoming exceptions.</p>
      ) : (
        <ul className="divide-y divide-[#eef2f6] rounded-xl border border-[#e1e7ef] bg-white">
          {upcoming.map((item) => (
            <li
              key={item.date}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-[#0E2340]">
                  {new Date(item.date + 'T12:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="text-[12px] text-[#65758b]">
                  {item.note ? `${item.note} · ` : ''}
                  {item.availability === 'closed'
                    ? 'Unavailable all day'
                    : `Reduced hours ${item.openTime ?? ''}–${item.closeTime ?? ''}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(item.date)}
                className="text-xs font-semibold text-[#65758b] hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
