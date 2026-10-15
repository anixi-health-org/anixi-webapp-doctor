import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import {
  addDaysToKey,
  dayNumber,
  localTodayKey,
  mondayOfWeek,
  weekdayLabel,
  weekKeys,
} from './bookingHelpers';

type Props = {
  selectedDate: string;
  onChange: (dateKey: string) => void;
  hasHoursOnDate: (dateKey: string) => boolean;
};

export const BookingWeekStrip: React.FC<Props> = ({
  selectedDate,
  onChange,
  hasHoursOnDate,
}) => {
  const today = localTodayKey();
  const days = weekKeys(selectedDate);
  const weekStart = mondayOfWeek(selectedDate);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
          Choose a day
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(addDaysToKey(weekStart, -7))}
            className="rounded-lg p-1.5 text-[#65758b] hover:bg-[#eef4f1] hover:text-anixi-green"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange(addDaysToKey(weekStart, 7))}
            className="rounded-lg p-1.5 text-[#65758b] hover:bg-[#eef4f1] hover:text-anixi-green"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((key) => {
          const isPast = key < today;
          const selected = key === selectedDate;
          const hasHours = hasHoursOnDate(key);
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => onChange(key)}
              className={clsx(
                'flex flex-col items-center rounded-xl border px-1 py-2 text-center transition',
                selected
                  ? 'border-anixi-green bg-anixi-green text-white shadow-sm'
                  : isPast
                    ? 'cursor-not-allowed border-transparent bg-[#f8fafc] text-[#c5ced8]'
                    : 'border-[#e1e7ef] bg-white text-[#344256] hover:border-anixi-green/40 hover:bg-[#eef4f1]',
              )}
            >
              <span className={clsx('text-[10px] font-semibold uppercase', selected ? 'text-white/80' : 'text-[#8FA0B6]')}>
                {weekdayLabel(key)}
              </span>
              <span className="mt-0.5 text-sm font-semibold tabular-nums">{dayNumber(key)}</span>
              <span
                className={clsx(
                  'mt-1 h-1.5 w-1.5 rounded-full',
                  selected ? 'bg-white' : hasHours ? 'bg-anixi-green' : 'bg-[#e1e7ef]',
                )}
                title={hasHours ? 'Clinic hours published' : 'No clinic hours'}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
