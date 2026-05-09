import React, { useState, useEffect } from 'react';
import { getMonthlyAdherence } from '../../services/adherenceService';

interface MedicationAdherenceCalendarProps {
  patientId: string;
  onSelectDate?: (date: string) => void;
  onViewDetails?: () => void;
}

export const MedicationAdherenceCalendar: React.FC<MedicationAdherenceCalendarProps> = ({
  patientId,
  onSelectDate,
  onViewDetails,
}) => {
  const [adherenceData, setAdherenceData] = useState<Map<string, 'taken' | 'missed' | 'pending'>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchAdherenceData = async () => {
      try {
        setLoading(true);
        const adherenceMap = await getMonthlyAdherence(
          patientId,
          currentDate.getFullYear(),
          currentDate.getMonth()
        );
        setAdherenceData(adherenceMap);
      } catch (err) {
        ;
        setError('Failed to load adherence data');
      } finally {
        setLoading(false);
      }
    };

    fetchAdherenceData();
  }, [patientId, currentDate]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const adherenceDates = Array.from(adherenceData.values());
  const takenDays = adherenceDates.filter((a) => a === 'taken').length;
  const adherencePercentage =
    adherenceDates.length > 0
      ? Math.round((takenDays / adherenceDates.length) * 100)
      : 0;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">📅 Adherence Calendar</h3>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : (
        <>
          {}
          <div className="mb-6 flex items-center gap-6">
            {}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {}
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                
                {}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  strokeDasharray={`${(adherencePercentage / 100) * 339.29} 339.29`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              
              {}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{adherencePercentage}%</p>
                  <p className="text-xs text-gray-600">Adherence</p>
                </div>
              </div>
            </div>

            {}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Days Recorded:</span>
                <span className="text-lg font-bold text-gray-900">{adherenceDates.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Days Taken:</span>
                <span className="text-lg font-bold text-green-600">{takenDays}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Days Missed:</span>
                <span className="text-lg font-bold text-red-600">{adherenceDates.filter((a) => a === 'missed').length}</span>
              </div>
            </div>
          </div>

          {}
          <div>
            {}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="text-gray-600 hover:text-gray-900 px-2 py-1"
              >
                ← Prev
              </button>
              <p className="font-bold text-gray-900">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={nextMonth}
                className="text-gray-600 hover:text-gray-900 px-2 py-1"
              >
                Next →
              </button>
            </div>

            {}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const dateStr =
                  day !== null
                    ? formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
                    : null;
                const adherenceStatus = dateStr && adherenceData.has(dateStr) ? adherenceData.get(dateStr) : null;

                return (
                  <button
                    key={idx}
                    onClick={() => dateStr && onSelectDate && onSelectDate(dateStr)}
                    disabled={day === null}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg text-sm font-medium
                      transition-all duration-200 cursor-pointer relative
                      ${day === null ? 'bg-transparent cursor-default' : 'hover:shadow-md hover:scale-105'}
                      ${
                        adherenceStatus === 'taken'
                          ? 'bg-green-100 text-green-800 font-bold border-2 border-green-400 hover:bg-green-200'
                          : adherenceStatus === 'missed'
                            ? 'bg-red-100 text-red-800 border-2 border-red-400 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-300 hover:bg-gray-200'
                      }
                    `}
                    title={dateStr || ''}
                  >
                    {day ? (
                      <>
                        <span>{day}</span>
                        {adherenceStatus === 'taken' && <span className="absolute text-lg">✓</span>}
                        {adherenceStatus === 'missed' && <span className="absolute text-lg">✗</span>}
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-900 mb-3">Legend</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-100 border-2 border-green-400 rounded flex items-center justify-center text-green-800 font-bold">✓</div>
                <span className="text-gray-700">Taken</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-red-100 border-2 border-red-400 rounded flex items-center justify-center text-red-800 font-bold">✗</div>
                <span className="text-gray-700">Missed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-100 border-2 border-gray-300 rounded"></div>
                <span className="text-gray-700">No Data</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">💡 Click on any day to view detailed adherence</p>
          </div>
        </>
      )}
    </div>
  );
};
