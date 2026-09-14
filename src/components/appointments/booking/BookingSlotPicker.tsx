import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import clsx from 'clsx';
import type { AvailableSlot, BookableBlock } from '../../../types';
import {
  diagnoseEmptySlots,
  formatHoursSummary,
  formatSlotTime,
  nextDateKeyWithHours,
  slotDurationMinutes,
  slotKey,
  type EmptySlotReason,
} from './bookingHelpers';

type Props = {
  selectedDate: string;
  doctorId: string;
  doctorName: string;
  hoursToday: BookableBlock[];
  doctorBlocks: BookableBlock[];
  slots: AvailableSlot[];
  rawSlotCount: number;
  loading: boolean;
  selectedSlot: AvailableSlot | null;
  onSelectSlot: (slot: AvailableSlot) => void;
  onJumpToDate: (dateKey: string) => void;
  canOverride: boolean;
  overrideMode: boolean;
  overrideTime: string;
  onOverrideTimeChange: (value: string) => void;
  onStartOverride: () => void;
  onCancelOverride: () => void;
  showHoursLink: boolean;
  otherDoctorHint?: { id: string; name: string } | null;
  onSwitchDoctor?: (doctorId: string) => void;
};

const groupSlots = (slots: AvailableSlot[]) => {
  const groups: { label: string; items: AvailableSlot[] }[] = [
    { label: 'Morning', items: [] },
    { label: 'Afternoon', items: [] },
    { label: 'Evening', items: [] },
  ];
  slots.forEach((slot) => {
    const hour = slot.startAt.getHours();
    if (hour < 12) groups[0].items.push(slot);
    else if (hour < 17) groups[1].items.push(slot);
    else groups[2].items.push(slot);
  });
  return groups.filter((group) => group.items.length > 0);
};

const emptyCopy = (
  reason: EmptySlotReason,
  doctorName: string,
  hoursSummary: string,
): { title: string; body: string } => {
  if (reason === 'no-doctor') {
    return {
      title: 'Choose a doctor',
      body: 'Select who will see this patient to load their available times.',
    };
  }
  if (reason === 'no-hours') {
    return {
      title: `${doctorName} has no clinic hours on this day`,
      body: 'Pick a day with a green dot, choose another doctor, or publish hours in clinic settings.',
    };
  }
  if (reason === 'past') {
    return {
      title: "Today's remaining hours have passed",
      body: hoursSummary
        ? `Published hours were ${hoursSummary}. Jump to the next clinic day to book.`
        : 'Jump to the next clinic day to book.',
    };
  }
  return {
    title: 'No open slots left on this day',
    body: hoursSummary
      ? `Published hours are ${hoursSummary}. Every slot may already be booked, or this visit type may not fit the remaining time.`
      : 'Try another day or visit type.',
  };
};

export const BookingSlotPicker: React.FC<Props> = ({
  selectedDate,
  doctorId,
  doctorName,
  hoursToday,
  doctorBlocks,
  slots,
  rawSlotCount,
  loading,
  selectedSlot,
  onSelectSlot,
  onJumpToDate,
  canOverride,
  overrideMode,
  overrideTime,
  onOverrideTimeChange,
  onStartOverride,
  onCancelOverride,
  showHoursLink,
  otherDoctorHint,
  onSwitchDoctor,
}) => {
  const hoursSummary = formatHoursSummary(hoursToday);
  const reason = diagnoseEmptySlots({
    doctorId,
    selectedDate,
    hoursToday,
    upcomingCount: slots.length,
    rawCount: rawSlotCount,
  });
  const copy = emptyCopy(reason, doctorName, hoursSummary);
  const nextDay = doctorId ? nextDateKeyWithHours(selectedDate, doctorBlocks, doctorId) : null;

  if (overrideMode) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-950">Book outside published hours</p>
            <p className="mt-1 text-sm text-amber-900">
              Use only when the doctor has agreed. This visit is recorded as an override.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelOverride}
            className="shrink-0 text-sm font-semibold text-amber-900 hover:underline"
          >
            Back to slots
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-amber-950">
          Start time
          <input
            type="time"
            value={overrideTime}
            onChange={(event) => onOverrideTimeChange(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-[#344256]"
            required
          />
        </label>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-[#344256]">Available times</label>
        {hoursSummary ? (
          <span className="inline-flex items-center gap-1 text-xs text-[#65758b]">
            <Clock className="h-3.5 w-3.5" />
            {hoursSummary}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-[#eef2f6]" />
          ))}
        </div>
      ) : slots.length > 0 ? (
        <div className="max-h-64 space-y-3 overflow-y-auto pr-0.5">
          {groupSlots(slots).map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.items.map((slot) => {
                  const selected = selectedSlot ? slotKey(selectedSlot) === slotKey(slot) : false;
                  return (
                    <button
                      type="button"
                      key={slotKey(slot)}
                      onClick={() => onSelectSlot(slot)}
                      aria-pressed={selected}
                      className={clsx(
                        'rounded-xl border px-2 py-2 text-sm font-semibold tabular-nums transition',
                        selected
                          ? 'border-anixi-green bg-anixi-green text-white shadow-sm'
                          : 'border-[#e1e7ef] bg-white text-[#344256] hover:border-anixi-green/50 hover:bg-[#eef4f1]',
                      )}
                    >
                      {formatSlotTime(slot.startAt)}
                      <span className={clsx('mt-0.5 block text-[10px] font-medium', selected ? 'text-white/80' : 'text-[#8FA0B6]')}>
                        {slotDurationMinutes(slot)} min
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e1e7ef] bg-[#fafcfb] p-4">
          <p className="text-sm font-semibold text-[#344256]">{copy.title}</p>
          <p className="mt-1 text-sm text-[#65758b]">{copy.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherDoctorHint && onSwitchDoctor ? (
              <button
                type="button"
                onClick={() => onSwitchDoctor(otherDoctorHint.id)}
                className="rounded-full bg-anixi-green px-3 py-1.5 text-xs font-semibold text-white"
              >
                Book with {otherDoctorHint.name}
              </button>
            ) : null}
            {nextDay ? (
              <button
                type="button"
                onClick={() => onJumpToDate(nextDay)}
                className="rounded-full border border-[#e1e7ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#344256]"
              >
                Next open day
              </button>
            ) : null}
            {showHoursLink ? (
              <Link
                to="/clinic/settings?tab=schedules"
                className="rounded-full border border-[#e1e7ef] bg-white px-3 py-1.5 text-xs font-semibold text-anixi-green"
              >
                Edit clinic hours
              </Link>
            ) : null}
            {canOverride ? (
              <button
                type="button"
                onClick={onStartOverride}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#65758b] hover:text-[#344256] hover:underline"
              >
                Book outside hours
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
