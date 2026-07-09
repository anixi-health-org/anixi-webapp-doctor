import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { parseLocalDate } from '../utils/dateFormatter';
import {
  getMoodEmoji,
  getMoodEntryStyles,
  getMoodScore,
  normalizeMoodLabel,
  type MoodValue,
} from '../lib/moodDisplay';

interface MoodEntry {
  id?: string;
  mood: MoodValue;
  notes?: string;
  createdAt?: Date | string | null;
  timestamp?: Date | string | null;
}

interface MoodDetailsPanelProps {
  moodEntries: MoodEntry[];
  selectedDate: string;
  isLoading: boolean;
  onClose: () => void;
}

export const MoodDetailsPanel: React.FC<MoodDetailsPanelProps> = ({
  moodEntries,
  selectedDate,
  isLoading,
  onClose,
}) => {
  const dateLabel =
    parseLocalDate(selectedDate)?.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) ?? selectedDate;

  const formatTime = (value: Date | string | null | undefined): string => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 bg-anixi-green px-6 py-5 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Mood entries</p>
            <h2 className="font-heading mt-1 text-xl font-semibold">{dateLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-anixi-green border-t-transparent" />
            </div>
          ) : moodEntries.length > 0 ? (
            <ul className="space-y-3">
              {moodEntries.map((entry, idx) => {
                const styles = getMoodEntryStyles(entry.mood);
                return (
                  <li
                    key={entry.id ?? idx}
                    className={`rounded-xl border p-4 ${styles.bg} ${styles.border}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
                        <div>
                          <p className={`font-semibold ${styles.text}`}>
                            {normalizeMoodLabel(entry.mood)}
                            {getMoodScore(entry.mood) !== null && (
                              <span className="ml-1 text-sm font-normal text-gray-500">
                                ({getMoodScore(entry.mood)}/5)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{formatTime(entry.createdAt)}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>
                    {entry.notes ? (
                      <p className="mt-3 border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
                        &ldquo;{entry.notes}&rdquo;
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-10 text-center">
              <p className="text-4xl">😐</p>
              <p className="mt-3 font-medium text-gray-700">No mood entries</p>
              <p className="mt-1 text-sm text-gray-500">Nothing logged on this date.</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodDetailsPanel;
