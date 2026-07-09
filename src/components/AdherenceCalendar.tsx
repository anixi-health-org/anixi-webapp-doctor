import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getDateString, isSameLocalDay } from '../utils/dateFormatter';
import { MedicationAdherenceDetailsPanel } from './MedicationAdherenceDetailsPanel';
import {
  getDoctorMonthlyAdherenceDetails,
  getMonthlyAdherenceDetails,
  type DayAdherenceDetails,
} from '../services/adherenceService';
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
  medications: Array<{
    id: string;
    name: string;
    status: string;
    scheduledTime: Date | null;
  }>;
}
export const AdherenceCalendar: React.FC<AdherenceCalendarProps> = ({ patientId, doctorId, onDayClick }) => {
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
            medications: [],
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

    loadMonthAdherence();
  }, [currentMonth, patientId, doctorId]);
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };
  const getAdherenceStyles = (percentage: number, hasData: boolean) => {
    if (!hasData) {
      return {
        cell: 'bg-white border-gray-200 text-gray-700 hover:border-anixi-green/40 hover:bg-anixi-green/5',
        badge: '',
      };
    }
    if (percentage >= 80) {
      return {
        cell: 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100',
        badge: 'bg-green-500',
      };
    }
    if (percentage >= 50) {
      return {
        cell: 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100',
        badge: 'bg-amber-500',
      };
    }
    return {
      cell: 'bg-red-50 border-red-300 text-red-900 hover:bg-red-100',
      badge: 'bg-red-500',
    };
  };

  const today = new Date();
  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[10vh]" >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#34d399"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(monthStats.adherencePercentage / 100) * 97.4} 97.4`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-anixi-green">{monthStats.adherencePercentage}%</span>
          </div>
        </div>

        <div className="flex min-w-[140px] flex-1 gap-4">
          <div>
            <p className="text-lg font-bold leading-none text-green-700">{monthStats.takenTotal}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Taken</p>
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-red-600">{monthStats.missedTotal}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Missed</p>
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-amber-600">{monthStats.pendingTotal}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Pending</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-3 py-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:text-anixi-green"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Prev
          </button>
          <h3 className="font-heading text-sm font-semibold text-gray-900">{monthName}</h3>
          <button
            type="button"
            onClick={handleNextMonth}
            className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:text-anixi-green"
          >
            Next
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-3">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div
                key={`${day}-${i}`}
                className="py-1 text-center text-[10px] font-semibold uppercase text-gray-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-9" />;
              }

              const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const dateStr = getDateString(cellDate);
              const adherence = dayAdherence.get(dateStr);
              const percentage = adherence?.percentage ?? 0;
              const hasData = Boolean(adherence && (adherence.taken + adherence.missed + adherence.pending > 0));
              const styles = getAdherenceStyles(percentage, hasData);
              const isToday = isSameLocalDay(cellDate, today);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    if (onDayClick) {
                      onDayClick(cellDate);
                    } else {
                      setSelectedDate(cellDate);
                      setShowDetailsPanel(true);
                    }
                  }}
                  className={`relative flex h-9 flex-col items-center justify-center rounded-lg border text-center transition-colors hover:shadow-sm ${styles.cell} ${
                    isToday ? 'ring-1 ring-anixi-green ring-offset-1' : ''
                  }`}
                  title={hasData ? `${percentage}% adherence` : undefined}
                >
                  <span className="text-xs font-semibold leading-none">{day}</span>
                  {hasData ? (
                    <span className="mt-0.5 text-[8px] font-bold leading-none opacity-80">{percentage}%</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2 text-center text-[10px] text-gray-500">
          Tap a day for medication, mood, and vitals.
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
