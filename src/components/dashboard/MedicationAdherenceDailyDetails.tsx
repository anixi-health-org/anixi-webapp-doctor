import React, { useState, useEffect } from 'react';
import { getDailyAdherence } from '../../services/adherenceService';
import { customColors } from '../../lib/customColors';

interface MedicationDetail {
  medicationName: string;
  dosage?: string;
  scheduledTime: any;
  status: 'taken' | 'missed' | 'pending';
  takenTime?: any;
  notes?: string;
  timeSlot?: 'morning' | 'afternoon' | 'evening';
}

interface DailyAdherenceData {
  date: string;
  mood?: Record<string, {
    emoji: string;
    level: string;
    notes?: string;
    timeSlot: 'morning' | 'afternoon' | 'evening';
    createdAt: string;
  }>; 
  medications: MedicationDetail[];
  vitals?: any;
}

interface MedicationAdherenceDailyDetailsProps {
  patientId: string;
  selectedDate: string;
  onBack: () => void;
}

export const MedicationAdherenceDailyDetails: React.FC<MedicationAdherenceDailyDetailsProps> = ({
  patientId,
  selectedDate,
  onBack,
}) => {
  const [dailyData, setDailyData] = useState<DailyAdherenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        setLoading(true);
        const data = await getDailyAdherence(patientId, selectedDate);

        setDailyData({
          date: selectedDate,
          mood: data.mood,
          medications: data.medications,
          vitals: data.vitals,
        });
      } catch (err) {
        ;
        setError('Failed to load daily adherence data');
      } finally {
        setLoading(false);
      }
    };

    fetchDailyData();
  }, [patientId, selectedDate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const renderMedicationStatus = (medicationName: string, timeSlot: 'morning' | 'afternoon' | 'evening') => {
    if (!dailyData?.medications) return <span className="inline-block w-4 h-4 rounded-full bg-gray-400"></span>;

    const med = dailyData.medications.find(m => m.medicationName === medicationName && m.timeSlot === timeSlot);
    if (!med) return <span className="inline-block w-4 h-4 rounded-full bg-gray-400"></span>;

    return (
      <span className={`inline-block w-4 h-4 rounded-full ${
        med.status === 'taken' ? 'bg-green-500' :
        med.status === 'missed' ? 'bg-red-500' :
        'bg-gray-400'
      }`}></span>
    );
  };

  const renderVitalsStatus = (vitalName: string, timeSlot: 'morning' | 'afternoon' | 'evening') => {
    if (!dailyData?.vitals) return <span className="inline-block w-4 h-4 rounded-full bg-gray-400"></span>;

    const vitals = dailyData.vitals;
    let hasData = false;

    switch (vitalName) {
      case 'Heart Rate':
        hasData = vitals.heartRate !== undefined;
        break;
      case 'Blood Pressure':
        hasData = !!vitals.bloodPressure;
        break;
      case 'Temperature':
        hasData = vitals.temperature !== undefined;
        break;
      case 'Blood Sugar':
        hasData = vitals.bloodSugar !== undefined;
        break;
    }

    return <span className={`inline-block w-4 h-4 rounded-full ${hasData ? 'bg-green-500' : 'bg-gray-400'}`}></span>;
  };

  const getMoodEmoji = (moodLevel: string | number) => {

    if (!moodLevel && moodLevel !== 0) {
      return '😐';
    }

    let stringMood: string;
    if (typeof moodLevel === 'number') {
      const numericMapping: Record<number, string> = {
        1: 'Very Sad',
        2: 'Sad',
        3: 'Neutral',
        4: 'Happy',
        5: 'Very Happy',
        0: 'Very Sad',
      };
      stringMood = numericMapping[moodLevel] || 'Neutral';
    } else {
      stringMood = moodLevel;
    }

    const moodMapping: Record<string, string> = {
      'happy': 'Happy',
      'neutral': 'Neutral',
      'sad': 'Sad',
      'anxious': 'Sad', 
      'tired': 'Neutral', 
      'frustrated': 'Sad', 
      'excellent': 'Very Happy',
      'good': 'Happy',
      'okay': 'Neutral',
      'bad': 'Sad',
      'terrible': 'Very Sad',
      'calm': 'Happy',
      'thoughtful': 'Neutral',
    };

    const standardizedMood = moodMapping[stringMood] || stringMood;

    const moodEmojis: Record<string, string> = {
      'Very Happy': '😄',
      'Happy': '🙂',
      'Neutral': '😐',
      'Sad': '😔',
      'Very Sad': '😢',
    };

    const emoji = moodEmojis[standardizedMood] || '😐';

    return emoji;
  };

  const renderMoodStatus = (timeSlot: 'morning' | 'afternoon' | 'evening') => {
    if (!dailyData?.mood || !dailyData.mood[timeSlot]) {
      return <span className="inline-block w-4 h-4 rounded-full bg-gray-400"></span>;
    }

    const moodData = dailyData.mood[timeSlot];

    const emoji = getMoodEmoji(moodData.level);

    return <span className="text-lg">{emoji}</span>;
  };

  const getMedicationRows = () => {
    if (!dailyData?.medications) return [];

    const uniqueMeds = new Set<string>();
    dailyData.medications.forEach(med => uniqueMeds.add(med.medicationName));

    return Array.from(uniqueMeds).map(name => ({
      name,
      type: 'medication' as const
    }));
  };

  const getVitalsRows = () => {
    if (!dailyData?.vitals) return [];

    const vitals = dailyData.vitals;
    const rows = [];

    if (vitals.heartRate !== undefined) rows.push({ name: 'Heart Rate', type: 'vitals' as const });
    if (vitals.bloodPressure) rows.push({ name: 'Blood Pressure', type: 'vitals' as const });
    if (vitals.temperature !== undefined) rows.push({ name: 'Temperature', type: 'vitals' as const });
    if (vitals.bloodSugar !== undefined) rows.push({ name: 'Blood Sugar', type: 'vitals' as const });

    return rows;
  };

  const getMoodRows = () => {
    return [{ name: 'Mood Check-in', type: 'mood' as const }];
  };

  const getAllRows = () => {
    return [
      ...getMedicationRows(),
      ...getMoodRows(),
      ...getVitalsRows()
    ];
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#425950]"></div>
          <span className="ml-2 text-gray-600">Loading daily details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <button
          onClick={onBack}
          className={`mb-4 text-[${customColors.textPrimary}] hover:text-[${customColors.primary}] font-medium`}
        >
          ← Back to Calendar
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      {}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <button
          onClick={onBack}
          className="mb-4 text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          ← Back to Calendar
        </button>
        <h2 className="text-2xl font-bold text-gray-900">
          📋 Daily Adherence - {formatDate(selectedDate)}
        </h2>
      </div>

      {}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900"></th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Morning</th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Afternoon</th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Evening</th>
            </tr>
          </thead>
          <tbody>
            {getAllRows().map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-3 font-medium text-gray-900">
                  {row.name}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-center">
                  {row.type === 'medication' ? renderMedicationStatus(row.name, 'morning') :
                   row.type === 'vitals' ? renderVitalsStatus(row.name, 'morning') :
                   renderMoodStatus('morning')}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-center">
                  {row.type === 'medication' ? renderMedicationStatus(row.name, 'afternoon') :
                   row.type === 'vitals' ? renderVitalsStatus(row.name, 'afternoon') :
                   renderMoodStatus('afternoon')}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-center">
                  {row.type === 'medication' ? renderMedicationStatus(row.name, 'evening') :
                   row.type === 'vitals' ? renderVitalsStatus(row.name, 'evening') :
                   renderMoodStatus('evening')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm font-semibold text-gray-900 mb-3">Status Legend</p>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-green-500"></span>
            <span className="text-gray-700">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-red-500"></span>
            <span className="text-gray-700">Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-gray-400"></span>
            <span className="text-gray-700">Not scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">😊</span>
            <span className="text-gray-700">Mood recorded</span>
          </div>
        </div>
      </div>
    </div>
  );
};
