import React, { useState } from 'react';
import { getCompleteDayData } from '../services/logsService';
import { formatTimestamp } from '../utils/dataFormatter';

const safeConvertValue = (value: any): any => {
  if (!value) return value;
  
  if (value.toDate && typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (e) {
      console.error('❌ Error converting Timestamp with toDate():', value, e);
      return '[TIMESTAMP_ERROR]';
    }
  }
  
  if (
    typeof value === 'object' &&
    value.seconds !== undefined &&
    value.nanoseconds !== undefined
  ) {
    try {
      return new Date(value.seconds * 1000);
    } catch (e) {
      console.error('❌ Error converting raw Timestamp:', value, e);
      return '[TIMESTAMP_ERROR]';
    }
  }
  
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  ) {
    if (typeof value.toDate === 'function' || (value.seconds !== undefined && value.nanoseconds !== undefined)) {
      console.warn('⚠️ Detected unconverted Timestamp-like object:', value);
      return '[TIMESTAMP_OBJECT]';
    }
  }
  
  return value;
};

interface MoodCalendarProps {
  patientId: string;
}

interface DayDetails {
  date: string;
  mood: any | null;
  medications: any[];
  adherenceRecord: any | null;
  vitals: any | null;
  hasData: boolean;
}

export const MoodCalendar: React.FC<MoodCalendarProps> = ({ patientId }) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<DayDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateString = (date: Date, day: number): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleDayClick = async (day: number) => {
    const dateStr = formatDateString(currentMonth, day);
    setIsLoading(true);
    try {
      const dayData = await getCompleteDayData(patientId, dateStr);
      console.log(`\n📅 MoodCalendar.handleDayClick - Day data received:`, dayData);
      
      if (dayData.mood) {
        console.log(`   - mood:`, dayData.mood);
        Object.entries(dayData.mood).forEach(([key, val]: [string, any]) => {
          if (val && typeof val === 'object' && !Array.isArray(val) && (val.seconds !== undefined || val.nanoseconds !== undefined)) {
            console.warn(`   ⚠️ UNCONVERTED TIMESTAMP in mood.${key}:`, val);
          }
        });
      }
      if (dayData.vitals) {
        console.log(`   - vitals:`, dayData.vitals);
        Object.entries(dayData.vitals).forEach(([key, val]: [string, any]) => {
          if (val && typeof val === 'object' && !Array.isArray(val) && (val.seconds !== undefined || val.nanoseconds !== undefined)) {
            console.warn(`   ⚠️ UNCONVERTED TIMESTAMP in vitals.${key}:`, val);
          }
        });
      }
      if (dayData.adherenceRecord) {
        console.log(`   - adherenceRecord:`, dayData.adherenceRecord);
        Object.entries(dayData.adherenceRecord).forEach(([key, val]: [string, any]) => {
          if (val && typeof val === 'object' && !Array.isArray(val) && (val.seconds !== undefined || val.nanoseconds !== undefined)) {
            console.warn(`   ⚠️ UNCONVERTED TIMESTAMP in adherenceRecord.${key}:`, val);
          }
        });
      }
      if (dayData.medications.length > 0) {
        console.log(`   - medications[0]:`, dayData.medications[0]);
        dayData.medications[0] && Object.entries(dayData.medications[0]).forEach(([key, val]: [string, any]) => {
          if (val && typeof val === 'object' && !Array.isArray(val) && (val.seconds !== undefined || val.nanoseconds !== undefined)) {
            console.warn(`   ⚠️ UNCONVERTED TIMESTAMP in medications[0].${key}:`, val);
          }
        });
      }
      
      setSelectedDay(dayData as DayDetails);
    } catch (error) {
      console.error('❌ Error in handleDayClick:', error);
    }
    setIsLoading(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    setSelectedDay(null);
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days: (number | null)[] = Array(firstDay).fill(null);

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-sm mx-auto">
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

      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="w-8 h-8" />;
          }

          return (
            <div
              key={day}
              className={`
                w-8 h-8 p-1 rounded-lg border-2 transition-all
                bg-white border-gray-300
                flex items-center justify-center
                cursor-default text-gray-400
              `}
            >
              <span className="text-xs font-bold text-gray-400">{day}</span>
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
        <p className="text-xs font-semibold text-yellow-900 mb-1">ℹ️ Info:</p>
        <p className="text-xs text-yellow-800">Calendar view disabled. Mood data is currently unavailable.</p>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {new Date(selectedDay.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-gray-500 hover:text-gray-700 font-bold text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {isLoading && (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading daily health data...</p>
              </div>
            )}

            {!isLoading && (
              <div className="space-y-6">
                <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">😊</span> Mood Checker
                  </h4>
                  {selectedDay.mood ? (
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-gray-900 capitalize">
                        {safeConvertValue(selectedDay.mood.mood) || 'Mood recorded'}
                      </p>
                      {selectedDay.mood.notes && (
                        <p className="text-sm text-gray-700 italic">
                          "{safeConvertValue(selectedDay.mood.notes)}"
                        </p>
                      )}
                      {selectedDay.mood.timestamp && (
                        <p className="text-xs text-gray-600">
                          Recorded at: {formatTimestamp(safeConvertValue(selectedDay.mood.timestamp), 'time')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No mood data available for this day</p>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">💊</span> Medication Adherence
                  </h4>
                  {selectedDay.medications && selectedDay.medications.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDay.medications.map((med) => (
                        <div
                          key={med.id}
                          className="flex items-center justify-between p-3 bg-white rounded border border-blue-100"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {safeConvertValue(med.name) || safeConvertValue(med.medicationName) || 'Medication'}
                            </p>
                            {med.dosage && (
                              <p className="text-xs text-gray-600">{safeConvertValue(med.dosage)}</p>
                            )}
                            {med.frequency && (
                              <p className="text-xs text-gray-600">{safeConvertValue(med.frequency)}</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            {med.taken === true && (
                              <div className="text-2xl">✅</div>
                            )}
                            {med.taken === false && (
                              <div className="text-2xl">❌</div>
                            )}
                            {med.taken === null && (
                              <span className="text-xs text-gray-500 font-medium">No record</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedDay.adherenceRecord && (
                        <p className="text-xs text-gray-600 mt-2">
                          Adherence recorded on: {formatTimestamp(safeConvertValue(selectedDay.adherenceRecord.timestamp), 'long')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No medications assigned to this patient</p>
                  )}
                </div>

                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">🏥</span> Vitals
                  </h4>
                  {selectedDay.vitals ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedDay.vitals.heartRate && (
                        <div className="bg-white p-3 rounded border border-red-100">
                          <p className="text-xs text-gray-600">Heart Rate</p>
                          <p className="text-lg font-bold text-gray-900">
                            {safeConvertValue(selectedDay.vitals.heartRate)} BPM
                          </p>
                        </div>
                      )}
                      {selectedDay.vitals.bloodPressure && (
                        <div className="bg-white p-3 rounded border border-red-100">
                          <p className="text-xs text-gray-600">Blood Pressure</p>
                          <p className="text-lg font-bold text-gray-900">
                            {safeConvertValue(selectedDay.vitals.bloodPressure.systolic)}/
                            {safeConvertValue(selectedDay.vitals.bloodPressure.diastolic)}
                          </p>
                          <p className="text-xs text-gray-600">mmHg</p>
                        </div>
                      )}
                      {selectedDay.vitals.temperature && (
                        <div className="bg-white p-3 rounded border border-red-100">
                          <p className="text-xs text-gray-600">Temperature</p>
                          <p className="text-lg font-bold text-gray-900">
                            {safeConvertValue(selectedDay.vitals.temperature)}°C
                          </p>
                        </div>
                      )}
                      {selectedDay.vitals.bloodSugar && (
                        <div className="bg-white p-3 rounded border border-red-100">
                          <p className="text-xs text-gray-600">Blood Sugar</p>
                          <p className="text-lg font-bold text-gray-900">
                            {safeConvertValue(selectedDay.vitals.bloodSugar)} mg/dL
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No vitals data available for this day</p>
                  )}
                  {selectedDay.vitals?.notes && (
                    <p className="text-xs text-gray-700 mt-3 italic p-2 bg-white rounded">
                      📝 {safeConvertValue(selectedDay.vitals.notes)}
                    </p>
                  )}
                </div>

                {!selectedDay.hasData && (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-900 font-medium">
                      ℹ️ No health data recorded for this date. Ask the patient to log their daily health information.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedDay(null)}
              className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

