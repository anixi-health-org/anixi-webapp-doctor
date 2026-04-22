import React from 'react';

interface MoodEntry {
  id: string;
  mood: string;
  notes?: string;
  createdAt: Date | null;
  timestamp?: Date | null;
  [key: string]: any;
}

interface MoodDetailsPanelProps {
  moodEntries: MoodEntry[];
  selectedDate: string;
  isLoading: boolean;
  onClose: () => void;
}

const getMoodEmoji = (mood: string): string => {
  const moodStr = String(mood || '').toLowerCase();
  const moodMap: { [key: string]: string } = {
    'excellent': '😄',
    'good': '😊',
    'neutral': '😐',
    'bad': '😔',
    'terrible': '😢',
    'very happy': '🤩',
    'happy': '😊',
    'sad': '😢',
    'angry': '😠',
    'anxious': '😰',
    'calm': '😌',
  };
  return moodMap[moodStr] || '😊';
};

const getMoodColor = (mood: string): string => {
  const moodStr = String(mood || '').toLowerCase();
  const colorMap: { [key: string]: string } = {
    'excellent': 'text-green-600',
    'good': 'text-green-500',
    'neutral': 'text-gray-500',
    'bad': 'text-orange-500',
    'terrible': 'text-red-600',
    'very happy': 'text-green-600',
    'happy': 'text-green-500',
    'sad': 'text-red-500',
    'angry': 'text-red-600',
    'anxious': 'text-yellow-600',
    'calm': 'text-blue-500',
  };
  return colorMap[moodStr] || 'text-gray-500';
};

const getMoodBgColor = (mood: string): string => {
  const moodStr = String(mood || '').toLowerCase();
  const colorMap: { [key: string]: string } = {
    'excellent': 'bg-green-50',
    'good': 'bg-green-50',
    'neutral': 'bg-gray-50',
    'bad': 'bg-orange-50',
    'terrible': 'bg-red-50',
    'very happy': 'bg-green-50',
    'happy': 'bg-green-50',
    'sad': 'bg-red-50',
    'angry': 'bg-red-50',
    'anxious': 'bg-yellow-50',
    'calm': 'bg-blue-50',
  };
  return colorMap[moodStr] || 'bg-gray-50';
};

const getMoodBorderColor = (mood: string): string => {
  const moodStr = String(mood || '').toLowerCase();
  const colorMap: { [key: string]: string } = {
    'excellent': 'border-green-300',
    'good': 'border-green-300',
    'neutral': 'border-gray-300',
    'bad': 'border-orange-300',
    'terrible': 'border-red-300',
    'very happy': 'border-green-300',
    'happy': 'border-green-300',
    'sad': 'border-red-300',
    'angry': 'border-red-300',
    'anxious': 'border-yellow-300',
    'calm': 'border-blue-300',
  };
  return colorMap[moodStr] || 'border-gray-300';
};

export const MoodDetailsPanel: React.FC<MoodDetailsPanelProps> = ({
  moodEntries,
  selectedDate,
  isLoading,
  onClose,
}) => {
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Invalid time';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50 transition-all">
      <div className="w-full bg-white rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto transform transition-transform">
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">😊 Mood Tracker Details</h2>
            <p className="text-gray-100 text-sm mt-1">{formatDate(new Date(selectedDate))}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading mood entries...</p>
              </div>
            </div>
          ) : moodEntries && moodEntries.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 font-semibold mb-4">
                Found <span className="text-purple-600">{moodEntries.length}</span> mood {moodEntries.length === 1 ? 'entry' : 'entries'} for this date
              </p>
              {moodEntries.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className={`p-5 rounded-lg border-2 transition-all hover:shadow-md ${getMoodBgColor(
                    entry.mood
                  )} ${getMoodBorderColor(entry.mood)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getMoodEmoji(entry.mood)}</span>
                      <div>
                        <h3 className={`text-lg font-semibold capitalize ${getMoodColor(entry.mood)}`}>
                          {entry.mood}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Recorded at {formatTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs bg-white bg-opacity-70 px-2 py-1 rounded-full text-gray-700">
                      #{idx + 1}
                    </span>
                  </div>

                  {entry.notes && (
                    <div className="mt-3 pl-12">
                      <p className="text-sm text-gray-700 italic border-l-2 border-gray-300 pl-3">
                        "{String(entry.notes)}"
                      </p>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-50">
                    <p className="text-xs text-gray-600">
                      Created: {formatDate(entry.createdAt)} at {formatTime(entry.createdAt)}
                    </p>
                    {entry.timestamp && 
                      entry.createdAt &&
                      new Date(entry.timestamp).getTime() !== new Date(entry.createdAt).getTime() && (
                      <p className="text-xs text-gray-600 mt-1">
                        Updated: {formatDate(entry.timestamp)} at {formatTime(entry.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">😊</div>
              <p className="text-gray-600 font-medium">No mood entries for this date</p>
              <p className="text-sm text-gray-500 mt-2">Patient hasn't logged any moods on {formatDate(new Date(selectedDate))}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodDetailsPanel;
