import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getDateString, isSameLocalDay } from '../utils/dateFormatter';
import { MedicationAdherenceDetailsPanel } from './MedicationAdherenceDetailsPanel';
import {
  getDoctorMonthlyAdherenceDetails,
  getMonthlyAdherenceDetails,
  type DayAdherenceDetails,
} from '../services/adherenceService';
import { Skeleton } from './ui/Skeleton';

interface AdherenceCalendarProps {
  patientId: string;
  doctorId?: string;
  onDayClick?: (date: Date) => void;
}

interface DayAdherence {
  date: string;
  taken: number;
  missed: number;
  pending: number;
  percentage: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AdherenceCalendar: React.FC<AdherenceCalendarProps> = ({
  patientId,
  doctorId,
  onDayClick,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayAdherence, setDayAdherence] = useState<Map<string, DayAdherence>>(new Map());
  const [monthStats, setMonthStats] = useState({
    takenTotal: 0,
    missedTotal: 0,
    pendingTotal: 0,
    adherencePercentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);

  useEffect(() => {
    const loadMonthAdherence = async () => {
      try {
        setIsLoading(true);
        const dayMap = new Map<string, DayAdherence>();

        const details = doctorId
          ? await getDoctorMonthlyAdherenceDetails(
              doctorId,
              patientId,
              currentMonth.getFullYear(),
              currentMonth.getMonth()
            )
          : await getMonthlyAdherenceDetails(
              patientId,
              currentMonth.getFullYear(),
              currentMonth.getMonth()
            );

        details.dayMap.forEach((day: DayAdherenceDetails) => {
          dayMap.set(day.date, {
            date: day.date,
            taken: day.taken,
            missed: day.missed,
            pending: day.pending,
            percentage: day.percentage,
          });
        });
        setDayAdherence(dayMap);
        setMonthStats(details.monthStats);
      } catch (error) {
        console.error('Error loading month adherence:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadMonthAdherence();
  }, [currentMonth, patientId, doctorId]);

  const today = new Date();
  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells: Array<number | null> = Array(firstDay).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const totalDoses =
    monthStats.takenTotal + monthStats.missedTotal + monthStats.pendingTotal;
  const hasMonthData = totalDoses > 0;
  const ringCircumference = 2 * Math.PI * 15.5;
  const ringProgress = hasMonthData
    ? (monthStats.adherencePercentage / 100) * ringCircumference
    : 0;

  const getAdherenceStyles = (percentage: number, hasData: boolean) => {
    if (!hasData) {
      return {
        cell: 'border-[#e1e7ef] bg-white text-[#344256] hover:border-[#427160]/40 hover:bg-[#eef4f1]',
        dot: 'bg-[#d1d5db]',
      };
    }
    if (percentage >= 80) {
      return {
        cell: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
        dot: 'bg-emerald-500',
      };
    }
    if (percentage >= 50) {
      return {
        cell: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
        dot: 'bg-amber-500',
      };
    }
    return {
      cell: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
      dot: 'bg-rose-500',
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-5">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="grid flex-1 grid-cols-3 gap-3">
              <Skeleton className="h-16 rounded-[10px]" />
              <Skeleton className="h-16 rounded-[10px]" />
              <Skeleton className="h-16 rounded-[10px]" />
            </div>
          </div>
        </div>
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
          <Skeleton className="mb-4 h-10 w-full rounded-[10px]" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-[10px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 sm:w-[220px] sm:shrink-0">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#eef2f6" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#427160"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${ringProgress} ${ringCircumference}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold leading-none text-[#344256]">
                  {monthStats.adherencePercentage}%
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
                  Month
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#344256]">{monthName}</p>
              <p className="mt-1 text-xs text-[#65758b]">
                {hasMonthData
                  ? `${totalDoses} doses logged this month`
                  : 'No adherence data logged yet'}
              </p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-3">
            {[
              {
                label: 'Taken',
                value: monthStats.takenTotal,
                tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
              },
              {
                label: 'Missed',
                value: monthStats.missedTotal,
                tone: 'bg-rose-50 text-rose-700 border-rose-100',
              },
              {
                label: 'Pending',
                value: monthStats.pendingTotal,
                tone: 'bg-amber-50 text-amber-700 border-amber-100',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-[10px] border px-3 py-3 text-center ${stat.tone}`}
              >
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eef2f6] px-4 py-3">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
              )
            }
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] transition-colors hover:border-[#427160]/40 hover:text-[#427160]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Prev
          </button>
          <h3 className="text-base font-semibold text-[#344256]">{monthName}</h3>
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
              )
            }
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] transition-colors hover:border-[#427160]/40 hover:text-[#427160]"
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="aspect-square rounded-[10px] bg-transparent"
                    aria-hidden
                  />
                );
              }

              const cellDate = new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                day
              );
              const dateStr = getDateString(cellDate);
              const adherence = dayAdherence.get(dateStr);
              const percentage = adherence?.percentage ?? 0;
              const hasData = Boolean(
                adherence && adherence.taken + adherence.missed + adherence.pending > 0
              );
              const styles = getAdherenceStyles(percentage, hasData);
              const isToday = isSameLocalDay(cellDate, today);
              const isSelected =
                selectedDate != null && isSameLocalDay(cellDate, selectedDate);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDate(cellDate);
                    if (onDayClick) {
                      onDayClick(cellDate);
                    } else {
                      setShowDetailsPanel(true);
                    }
                  }}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-[10px] border transition-all ${styles.cell} ${
                    isToday ? 'ring-2 ring-[#427160] ring-offset-1' : ''
                  } ${isSelected ? 'border-[#344256] shadow-sm' : ''}`}
                  title={hasData ? `${percentage}% adherence` : 'No data'}
                >
                  <span className="text-sm font-semibold leading-none sm:text-base">{day}</span>
                  {hasData ? (
                    <>
                      <span className="mt-1 text-[10px] font-bold leading-none opacity-80 sm:text-[11px]">
                        {percentage}%
                      </span>
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 rounded-full ${styles.dot}`}
                        aria-hidden
                      />
                    </>
                  ) : (
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-transparent" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-[#eef2f6] pt-4 text-xs text-[#65758b]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Good (≥80%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Fair (50-79%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Low (&lt;50%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-[#d1d5db] bg-white" />
              No data
            </span>
          </div>
        </div>

        <div className="border-t border-[#eef2f6] bg-[#f8fafc] px-4 py-3 text-center text-xs text-[#65758b]">
          Select a day to view medication, mood, and vitals.
        </div>
      </div>

      <MedicationAdherenceDetailsPanel
        doctorId={doctorId}
        patientId={patientId}
        selectedDate={selectedDate}
        isOpen={showDetailsPanel}
        onClose={() => setShowDetailsPanel(false)}
      />
    </div>
  );
};
