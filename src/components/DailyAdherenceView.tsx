import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { formatTimestamp, getDateString, getTimeSlot } from '../utils/dateFormatter';
import { getDailyAdherence, getDoctorDailyAdherence } from '../services/adherenceService';
interface DailyAdherenceViewProps {
  patientId: string;
  doctorId?: string;
  date: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
}
interface MoodEntry {
  timestamp?: Date | null;
  mood: string;
  notes?: string;
}
interface MedicationEntry {
  medicationName: string;
  dosage: string;
  scheduledTime?: Date | null;
  status: 'taken' | 'missed' | 'pending';
  takenTime?: Date | null;
  timeSlot: 'morning' | 'afternoon' | 'evening';
}
interface DailyData {
  moodEntries: MoodEntry[];
  medications: { [key in 'morning' | 'afternoon' | 'evening']: MedicationEntry[] };
  vitals?: any;
}
export const DailyAdherenceView: React.FC<DailyAdherenceViewProps> = ({
  patientId,
  doctorId,
  date,
  onPreviousDay,
  onNextDay,
}) => {
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dateStr = getDateString(date);

  useEffect(() => {
    const loadDailyData = async () => {
      try {
        setIsLoading(true);
        const result = doctorId
          ? await getDoctorDailyAdherence(doctorId, patientId, dateStr)
          : await getDailyAdherence(patientId, dateStr);

        const moodEntries = Object.values(result.mood || {}).map((mood: any) => ({
          timestamp: mood.createdAt ? new Date(mood.createdAt) : null,
          mood: mood.level || 'neutral',
          notes: mood.notes,
        }));

        const medicationsByTimeSlot: {
          [key in 'morning' | 'afternoon' | 'evening']: MedicationEntry[];
        } = {
          morning: [],
          afternoon: [],
          evening: [],
        };

        result.medications.forEach((data) => {
          const scheduledTime = data.scheduledTime?.toDate?.() || data.scheduledTime || null;
          const takenTime = data.takenTime?.toDate?.() || data.takenTime || null;
          const timeSlot = getTimeSlot(scheduledTime);
          medicationsByTimeSlot[timeSlot].push({
            medicationName: data.medicationName || 'Unknown',
            dosage: data.dosage || 'Not specified',
            scheduledTime,
            status: data.status || 'pending',
            takenTime,
            timeSlot,
          });
        });

        setDailyData({
          moodEntries,
          medications: medicationsByTimeSlot,
          vitals: result.vitals || null,
        });
      } catch (error) {
        ;
        setDailyData({
          moodEntries: [],
          medications: { morning: [], afternoon: [], evening: [] },
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDailyData();
  }, [dateStr, patientId, doctorId]);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[10vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  const getMoodEmoji = (mood: string) => {
    const moodMap: { [key: string]: string } = {
      excellent: '😄',
      good: '😊',
      neutral: '😐',
      bad: '😞',
      terrible: '😢',
    };
    return moodMap[mood] || '😐';
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return 'bg-gray-50 text-green-800 border-green-300';
      case 'missed':
        return 'bg-gray-50 text-red-800 border-red-300';
      case 'pending':
        return 'bg-gray-50 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-300';
    }
  };
  const timeSlots: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];
  const timeSlotLabels = {
    morning: '🌅 Morning (6AM - 12PM)',
    afternoon: '☀️ Afternoon (12PM - 6PM)',
    evening: '🌙 Evening (6PM - 12AM)',
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onPreviousDay}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Previous Day
        </button>
        <h2 className="text-center font-heading text-xl font-semibold text-gray-900 sm:text-2xl">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        <button
          type="button"
          onClick={onNextDay}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          Next Day
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      {dailyData?.moodEntries && dailyData.moodEntries.length > 0 && (
        <div className="p-4 bg-gray-50 border-2 border-purple-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">😊 Mood Entries</h3>
          <div className="space-y-2">
            {dailyData.moodEntries.map((mood, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-purple-100">
                <span className="text-2xl">{getMoodEmoji(mood.mood)}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 capitalize">{mood.mood}</p>
                  {mood.notes && <p className="text-xs text-gray-600 italic">"{mood.notes}"</p>}
                </div>
                {mood.timestamp && (
                  <span className="text-xs text-gray-600">{formatTimestamp(mood.timestamp, 'time')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
          <div className="space-y-4">
        {timeSlots.map((timeSlot) => (
          <div key={timeSlot} className="p-4 bg-gray-50 border-2 border-blue-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">{timeSlotLabels[timeSlot]}</h3>
            {dailyData?.medications[timeSlot] && dailyData.medications[timeSlot].length > 0 ? (
              <div className="space-y-2">
                {dailyData.medications[timeSlot].map((med, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-2 ${getStatusColor(med.status)}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-gray-900">{med.medicationName}</p>
                        <p className="text-sm text-gray-700">{med.dosage}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        med.status === 'taken' ? 'bg-green-200 text-green-900' :
                        med.status === 'missed' ? 'bg-red-200 text-red-900' :
                        'bg-yellow-200 text-yellow-900'
                      }`}>
                        {med.status === 'taken' ? '✓' : med.status === 'missed' ? '✕' : '?'}
                        {' '}
                        {med.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 mt-2 pt-2 border-t border-current border-opacity-20">
                      {med.scheduledTime && (
                        <p>
                          📋 Scheduled: <span className="font-medium">{formatTimestamp(med.scheduledTime, 'time')}</span>
                        </p>
                      )}
                      {med.takenTime && (
                        <p>
                          ✓ Taken: <span className="font-medium text-green-700">{formatTimestamp(med.takenTime, 'time')}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No medications scheduled for this time slot</p>
            )}
          </div>
        ))}
      </div>
      {dailyData?.vitals && (
        <div className="p-4 bg-gray-50 border-2 border-red-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">🏥 Vitals</h3>
          <div className="grid grid-cols-2 gap-3">
            {dailyData.vitals.heartRate && (
              <div className="p-3 bg-gray-50 rounded border border-red-100">
                <p className="text-xs text-gray-600">Heart Rate</p>
                <p className="text-lg font-bold text-gray-900">{dailyData.vitals.heartRate} BPM</p>
              </div>
            )}
            {dailyData.vitals.bloodPressure && (
              <div className="p-3 bg-gray-50 rounded border border-red-100">
                <p className="text-xs text-gray-600">Blood Pressure</p>
                <p className="text-lg font-bold text-gray-900">
                  {dailyData.vitals.bloodPressure.systolic}/{dailyData.vitals.bloodPressure.diastolic}
                </p>
              </div>
            )}
            {dailyData.vitals.temperature && (
              <div className="p-3 bg-gray-50 rounded border border-red-100">
                <p className="text-xs text-gray-600">Temperature</p>
                <p className="text-lg font-bold text-gray-900">{dailyData.vitals.temperature}°C</p>
              </div>
            )}
            {dailyData.vitals.bloodSugar && (
              <div className="p-3 bg-gray-50 rounded border border-red-100">
                <p className="text-xs text-gray-600">Blood Sugar</p>
                <p className="text-lg font-bold text-gray-900">{dailyData.vitals.bloodSugar} mg/dL</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
