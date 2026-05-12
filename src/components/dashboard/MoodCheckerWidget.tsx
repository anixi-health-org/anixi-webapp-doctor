import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { USERS_COLLECTION } from '../../shared/constants';
import { convertTimestamp } from '../../utils/dateFormatter';

interface MoodEntry {
  date: string;
  mood: 'excellent' | 'good' | 'okay' | 'bad' | 'terrible';
  notes?: string;
}

interface MoodCheckerWidgetProps {
  patientId: string;
  onViewDetails?: () => void;
}

export const MoodCheckerWidget: React.FC<MoodCheckerWidgetProps> = ({ patientId, onViewDetails }) => {
  const [latestMood, setLatestMood] = useState<MoodEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestMood = async () => {
      try {
        setLoading(true);
        const moodRef = collection(db, USERS_COLLECTION, patientId, 'mood_entries');
        const q = query(moodRef, orderBy('date', 'desc'), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          const dateObj = convertTimestamp(data.date);
          setLatestMood({
            date: dateObj
              ? dateObj.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              : typeof data.date === 'string' ? data.date : '',
            mood: data.mood,
            notes: data.notes,
          });
        }
      } catch (err) {
        ;
        setError('Failed to load mood data');
      } finally {
        setLoading(false);
      }
    };

    fetchLatestMood();
  }, [patientId]);

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case 'excellent':
        return '😄';
      case 'good':
        return '🙂';
      case 'okay':
        return '😐';
      case 'bad':
        return '😟';
      case 'terrible':
        return '😢';
      default:
        return '❓';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'excellent':
        return 'from-green-400 to-green-600';
      case 'good':
        return 'from-blue-400 to-blue-600';
      case 'okay':
        return 'from-yellow-400 to-yellow-600';
      case 'bad':
        return 'from-orange-400 to-orange-600';
      case 'terrible':
        return 'from-red-400 to-red-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">🎭 Mood Checker</h3>
        <button
          onClick={onViewDetails}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Details →
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : latestMood ? (
        <div className="space-y-4">
          <div className={`bg-gradient-to-r ${getMoodColor(latestMood.mood)} p-6 rounded-lg text-white`}>
            <p className="text-sm text-white/80 mb-2">Latest Mood</p>
            <div className="flex items-center gap-3">
              <span className="text-5xl">{getMoodEmoji(latestMood.mood)}</span>
              <div>
                <p className="text-2xl font-bold capitalize">{latestMood.mood}</p>
                <p className="text-sm text-white/80">{latestMood.date}</p>
              </div>
            </div>
          </div>
          {latestMood.notes && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Notes</p>
              <p className="text-gray-900">{latestMood.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">
          <p className="text-sm">No mood data yet</p>
        </div>
      )}
    </div>
  );
};
