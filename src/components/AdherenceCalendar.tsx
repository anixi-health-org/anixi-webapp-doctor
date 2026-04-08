import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDateString, convertTimestamp } from '../utils/dateFormatter';

interface AdherenceCalendarProps {
  patientId: string;
  onDayClick: (date: Date) => void;
}

interface DayAdherence {
  date: string;
  taken: number;
  missed: number;
  pending: number;
  percentage: number;
}

export const AdherenceCalendar: React.FC<AdherenceCalendarProps> = ({ patientId, onDayClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayAdherence, setDayAdherence] = useState<Map<string, DayAdherence>>(new Map());
  const [monthStats, setMonthStats] = useState({
    takenTotal: 0,
    missedTotal: 0,
    pendingTotal: 0,
    adherencePercentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMonthAdherence();
  }, [currentMonth, patientId]);

  const loadMonthAdherence = async () => {
    try {
      setIsLoading(true);

      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const adherenceQuery = query(
        collection(db, `Users/${patientId}/adherence_records`),
        where('scheduledTime', '>=', monthStart),
        where('scheduledTime', '<=', monthEnd)
      );

      const snapshot = await getDocs(adherenceQuery);
      const dayMap = new Map<string, DayAdherence>();
      let totalTaken = 0,
        totalMissed = 0,
        totalPending = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const scheduledTime = convertTimestamp(data.scheduledTime);
        const dateStr = getDateString(scheduledTime || new Date());
        const status = data.status || 'pending';

        let current = dayMap.get(dateStr) || {
          date: dateStr,
          taken: 0,
          missed: 0,
          pending: 0,
          percentage: 0,
        };

        if (status === 'taken') {
          current.taken++;
          totalTaken++;
        } else if (status === 'missed') {
          current.missed++;
          totalMissed++;
        } else {
          current.pending++;
          totalPending++;
        }

        const total = current.taken + current.missed + current.pending;
        current.percentage = total > 0 ? Math.round((current.taken / total) * 100) : 0;

        dayMap.set(dateStr, current);
      });

      setDayAdherence(dayMap);

      const grandTotal = totalTaken + totalMissed + totalPending;
      setMonthStats({
        takenTotal: totalTaken,
        missedTotal: totalMissed,
        pendingTotal: totalPending,
        adherencePercentage: grandTotal > 0 ? Math.round((totalTaken / grandTotal) * 100) : 0,
      });
    } catch (error) {
      console.error('Error loading month adherence:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getAdherenceColor = (percentage: number) => {
    if (percentage === 0) return 'bg-gray-50 border-gray-200';
    if (percentage >= 80) return 'bg-green-100 border-green-300';
    if (percentage >= 50) return 'bg-yellow-100 border-yellow-300';
    return 'bg-red-100 border-red-300';
  };

  const getAdherenceTextColor = (percentage: number) => {
    if (percentage === 0) return 'text-gray-600';
    if (percentage >= 80) return 'text-green-800';
    if (percentage >= 50) return 'text-yellow-800';
    return 'text-red-800';
  };

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
    <div className="max-w-sm mx-auto space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
            <p className="text-xs text-gray-600">Medications Taken</p>
            <p className="text-2xl font-bold text-green-700">{monthStats.takenTotal}</p>
          </div>
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-xs text-gray-600">Medications Missed</p>
            <p className="text-2xl font-bold text-red-700">{monthStats.missedTotal}</p>
          </div>
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <p className="text-xs text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">{monthStats.pendingTotal}</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="relative w-32 h-32 mb-2">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f87171"
                strokeWidth="8"
                strokeDasharray={`${(monthStats.missedTotal / (monthStats.takenTotal + monthStats.missedTotal + monthStats.pendingTotal)) * 251} 251`}
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="8"
                strokeDasharray={`${(monthStats.pendingTotal / (monthStats.takenTotal + monthStats.missedTotal + monthStats.pendingTotal)) * 251} 251`}
                strokeDashoffset={`-${(monthStats.missedTotal / (monthStats.takenTotal + monthStats.missedTotal + monthStats.pendingTotal)) * 251}`}
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#34d399"
                strokeWidth="8"
                strokeDasharray={`${(monthStats.takenTotal / (monthStats.takenTotal + monthStats.missedTotal + monthStats.pendingTotal)) * 251} 251`}
                strokeDashoffset={`-${((monthStats.missedTotal + monthStats.pendingTotal) / (monthStats.takenTotal + monthStats.missedTotal + monthStats.pendingTotal)) * 251}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{monthStats.adherencePercentage}%</p>
                <p className="text-xs text-gray-600">Adherence</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded"></div>
              <span>Taken</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded"></div>
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded"></div>
              <span>Pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4 gap-2">
          <button
            onClick={handlePrevMonth}
            className="px-2 py-1 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded text-xs font-medium transition-colors"
          >
            ← Prev
          </button>
          <h3 className="text-lg font-bold text-gray-900">{monthName}</h3>
          <button
            onClick={handleNextMonth}
            className="px-2 py-1 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded text-xs font-medium transition-colors"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-gray-700 py-1 text-xs">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="w-8 h-8" />;
            }

            const dateStr = getDateString(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
            );
            const adherence = dayAdherence.get(dateStr);
            const percentage = adherence?.percentage ?? 0;

            return (
              <button
                key={day}
                onClick={() =>
                  onDayClick(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                  )
                }
                className={`w-8 h-8 p-1 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md flex items-center justify-center ${getAdherenceColor(percentage)}`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className="text-xs font-bold text-gray-900">{day}</span>
                  {adherence && (
                    <span className={`text-xs font-semibold leading-none ${getAdherenceTextColor(percentage)}`}>
                      {percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
