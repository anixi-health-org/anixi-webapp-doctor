import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatTimestamp, getDateString, getTimeSlot, convertTimestamp, transformVitalsRecord } from '../utils/dateFormatter';

interface DailyAdherenceViewProps {
  patientId: string;
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
  date,
  onPreviousDay,
  onNextDay,
}) => {
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dateStr = getDateString(date);

  useEffect(() => {
    loadDailyData();
  }, [dateStr, patientId]);

  const loadDailyData = async () => {
    try {
      setIsLoading(true);

      const moodQuery = query(
        collection(db, `Users/${patientId}/mood_entries`),
        where('timestamp', '>=', new Date(date.getTime())),
        where('timestamp', '<', new Date(date.getTime() + 24 * 60 * 60 * 1000))
      );
      const moodSnapshot = await getDocs(moodQuery);
      const moodEntries = moodSnapshot.docs.map((doc) => ({
        timestamp: convertTimestamp(doc.data().timestamp),
        mood: doc.data().mood,
        notes: doc.data().notes,
      }));

      const adherenceQuery = query(
        collection(db, `Users/${patientId}/adherence_records`),
        where('scheduledTime', '>=', new Date(date.getTime())),
        where('scheduledTime', '<', new Date(date.getTime() + 24 * 60 * 60 * 1000))
      );
      const adherenceSnapshot = await getDocs(adherenceQuery);

      const medicationsByTimeSlot: { [key in 'morning' | 'afternoon' | 'evening']: MedicationEntry[] } = {
        morning: [],
        afternoon: [],
        evening: [],
      };

      adherenceSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const scheduledTime = convertTimestamp(data.scheduledTime);
        const timeSlot = getTimeSlot(scheduledTime);

        medicationsByTimeSlot[timeSlot].push({
          medicationName: data.medicationName,
          dosage: data.dosage,
          scheduledTime,
          status: data.status || 'pending',
          takenTime: convertTimestamp(data.takenTime),
          timeSlot,
        });
      });

      const vitalsQuery = query(
        collection(db, `Users/${patientId}/vitals_records`),
        where('timestamp', '>=', new Date(date.getTime())),
        where('timestamp', '<', new Date(date.getTime() + 24 * 60 * 60 * 1000))
      );
      const vitalsSnapshot = await getDocs(vitalsQuery);
      const vitals = vitalsSnapshot.docs.length > 0 ? transformVitalsRecord(vitalsSnapshot.docs[0].data()) : null;

      setDailyData({
        moodEntries,
        medications: medicationsByTimeSlot,
        vitals,
      });
    } catch (error) {
      console.error('Error loading daily adherence data:', error);
      setDailyData({
        moodEntries: [],
        medications: { morning: [], afternoon: [], evening: [] },
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        return 'bg-green-100 text-green-800 border-green-300';
      case 'missed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
        <button
          onClick={onPreviousDay}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Previous Day
        </button>
        <h2 className="text-2xl font-bold text-gray-900">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        <button
          onClick={onNextDay}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Next Day →
        </button>
      </div>

      {dailyData?.moodEntries && dailyData.moodEntries.length > 0 && (
        <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">😊 Mood Entries</h3>
          <div className="space-y-2">
            {dailyData.moodEntries.map((mood, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded border border-purple-100">
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
          <div key={timeSlot} className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
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
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">🏥 Vitals</h3>
          <div className="grid grid-cols-2 gap-3">
            {dailyData.vitals.heartRate && (
              <div className="p-3 bg-white rounded border border-red-100">
                <p className="text-xs text-gray-600">Heart Rate</p>
                <p className="text-lg font-bold text-gray-900">{dailyData.vitals.heartRate} BPM</p>
              </div>
            )}
            {dailyData.vitals.bloodPressure && (
              <div className="p-3 bg-white rounded border border-red-100">
                <p className="text-xs text-gray-600">Blood Pressure</p>
                <p className="text-lg font-bold text-gray-900">
                  {dailyData.vitals.bloodPressure.systolic}/{dailyData.vitals.bloodPressure.diastolic}
                </p>
              </div>
            )}
            {dailyData.vitals.temperature && (
              <div className="p-3 bg-white rounded border border-red-100">
                <p className="text-xs text-gray-600">Temperature</p>
                <p className="text-lg font-bold text-gray-900">{dailyData.vitals.temperature}°C</p>
              </div>
            )}
            {dailyData.vitals.bloodSugar && (
              <div className="p-3 bg-white rounded border border-red-100">
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
