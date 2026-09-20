import React, { useState, useEffect } from 'react';
import { djangoListMood, isDjangoApiEnabled } from '../../services/djangoApiService';

interface MoodEntry {
  date: string;
  mood: 'excellent' | 'good' | 'okay' | 'bad' | 'terrible';
  notes?: string;
}

interface MoodCheckerWidgetProps {
  patientId: string;
  onViewDetails?: () => void;
}

function scoreToMood(score: number): MoodEntry['mood'] {
  if (score >= 5) return 'excellent';
  if (score >= 4) return 'good';
  if (score >= 3) return 'okay';
  if (score >= 2) return 'bad';
  return 'terrible';
}

export const MoodCheckerWidget: React.FC<MoodCheckerWidgetProps> = ({ patientId, onViewDetails }) => {
  const [latestMood, setLatestMood] = useState<MoodEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestMood = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!isDjangoApiEnabled()) {
          setLatestMood(null);
          return;
        }
        const rows = await djangoListMood(patientId, { limit: 1 });
        const latest = rows[0];
        if (!latest) {
          setLatestMood(null);
          return;
        }
        const score = Number(latest.score ?? latest.mood ?? 0);
        setLatestMood({
          date: latest.recordedAt
            ? new Date(String(latest.recordedAt)).toLocaleDateString()
            : 'Recent',
          mood: scoreToMood(score),
          notes: String(latest.note ?? latest.notes ?? ''),
        });
      } catch {
        setError('Failed to load mood data');
      } finally {
        setLoading(false);
      }
    };

    void fetchLatestMood();
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
          {latestMood.notes ? (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Notes</p>
              <p className="text-gray-900">{latestMood.notes}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">
          <p className="text-sm">No mood data yet</p>
        </div>
      )}
    </div>
  );
};
