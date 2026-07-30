import React, { useEffect, useMemo, useState } from 'react';
import {
  BeakerIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FaceSmileIcon,
  HeartIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getCompleteDayData, getMoodEntriesForMonth } from '../services/logsService';
import { formatTimestamp } from '../utils/dataFormatter';
import { getDateString, isSameLocalDay, parseLocalDate } from '../utils/dateFormatter';
import {
  averageMoodScore,
  getMoodCalendarStyles,
  getMoodEmoji,
  getMoodEntryStyles,
  getMoodScore,
  normalizeMoodLabel,
} from '../lib/moodDisplay';
import { ListRowsSkeleton } from './ui/Skeleton';

interface MoodCalendarProps {
  patientId: string;
}

interface DayDetails {
  date: string;
  mood: Record<string, unknown> | null;
  moodEntries: Array<Record<string, unknown>>;
  medications: Array<Record<string, unknown>>;
  adherenceRecord: Record<string, unknown> | null;
  vitals: Record<string, unknown> | null;
  hasData: boolean;
}

export const MoodCalendar: React.FC<MoodCalendarProps> = ({ patientId }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayDetails | null>(null);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [monthMoodEntries, setMonthMoodEntries] = useState<Map<string, Array<Record<string, unknown>>>>(new Map());

  useEffect(() => {
    const loadMonthMoods = async () => {
      try {
        const entries = await getMoodEntriesForMonth(
          patientId,
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1
        );
        const moodMap = new Map<string, Array<Record<string, unknown>>>();

        entries.forEach((entry) => {
          const createdDate = new Date(entry.createdAt as string | Date);
          const dateStr = getDateString(createdDate);
          const list = moodMap.get(dateStr) ?? [];
          list.push(entry);
          moodMap.set(dateStr, list);
        });

        setMonthMoodEntries(moodMap);
      } catch {
        setMonthMoodEntries(new Map());
      }
    };

    void loadMonthMoods();
  }, [currentMonth, patientId]);

  const monthStats = useMemo(() => {
    let daysLogged = 0;
    const allScores: number[] = [];

    monthMoodEntries.forEach((entries) => {
      if (entries.length > 0) {
        daysLogged += 1;
        const avg = averageMoodScore(entries as Array<{ mood?: string | number }>);
        if (avg !== null) allScores.push(avg);
      }
    });

    const avgScore =
      allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : null;

    return { daysLogged, avgScore, totalEntries: Array.from(monthMoodEntries.values()).flat().length };
  }, [monthMoodEntries]);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleDayClick = async (day: number) => {
    const dateStr = getDateString(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    setIsLoadingDay(true);
    try {
      const dayData = await getCompleteDayData(patientId, dateStr);
      setSelectedDay(dayData as DayDetails);
    } catch {
      setSelectedDay(null);
    } finally {
      setIsLoadingDay(false);
    }
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
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  const selectedDateLabel = selectedDay
    ? (parseLocalDate(selectedDay.date)?.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }) ?? selectedDay.date)
    : '';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-anixi-green/20 bg-anixi-green/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-anixi-green">Days logged</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{monthStats.daysLogged}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Total entries</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{monthStats.totalEntries}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avg mood (month)</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-gray-900">
            {monthStats.avgScore !== null ? (
              <>
                <span>{getMoodEmoji(monthStats.avgScore)}</span>
                <span>{monthStats.avgScore}/5</span>
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-anixi-green/30 hover:text-anixi-green"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Prev
          </button>
          <h3 className="font-heading text-lg font-semibold text-gray-900 sm:text-xl">{monthName}</h3>
          <button
            type="button"
            onClick={handleNextMonth}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-anixi-green/30 hover:text-anixi-green"
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const dateStr = getDateString(cellDate);
              const entries = monthMoodEntries.get(dateStr) ?? [];
              const avgScore = averageMoodScore(entries as Array<{ mood?: string | number }>);
              const styles = getMoodCalendarStyles(avgScore);
              const isToday = isSameLocalDay(cellDate, today);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => void handleDayClick(day)}
                  className={`group relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-1 transition-all hover:shadow-md ${styles.cell} ${
                    isToday ? 'ring-2 ring-anixi-green ring-offset-2' : ''
                  }`}
                  title={
                    entries.length > 0
                      ? `${entries.length} mood ${entries.length === 1 ? 'entry' : 'entries'}`
                      : 'No mood entries'
                  }
                >
                  <span className="text-sm font-semibold sm:text-base">{day}</span>
                  {entries.length > 0 ? (
                    <span className="mt-0.5 text-lg leading-none">{getMoodEmoji(avgScore ?? entries[0].mood as string | number)}</span>
                  ) : (
                    <span className="mt-1 text-[10px] text-gray-400">—</span>
                  )}
                  {styles.dot ? (
                    <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-xs text-gray-600 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            Positive (4–5)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Neutral (3)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Low (1–2)
          </span>
          <span className="text-gray-400">· Tap a day for full details</span>
        </div>
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mood-day-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 bg-anixi-green px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Daily summary</p>
                <h3 id="mood-day-title" className="font-heading mt-1 text-xl font-semibold sm:text-2xl">
                  {selectedDateLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingDay ? (
                <ListRowsSkeleton rows={4} />
              ) : (
                <div className="space-y-5">
                  <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <FaceSmileIcon className="h-5 w-5 text-anixi-green" />
                      <h4 className="font-semibold text-gray-900">Mood</h4>
                    </div>
                    {selectedDay.moodEntries.length > 0 ? (
                      <ul className="space-y-3">
                        {selectedDay.moodEntries.map((entry, idx) => {
                          const mood = entry.mood as string | number;
                          const styles = getMoodEntryStyles(mood);
                          return (
                            <li
                              key={(entry.id as string) ?? idx}
                              className={`rounded-xl border p-4 ${styles.bg} ${styles.border}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{getMoodEmoji(mood)}</span>
                                  <div>
                                    <p className={`font-semibold ${styles.text}`}>
                                      {normalizeMoodLabel(mood)}
                                      {getMoodScore(mood) !== null && (
                                        <span className="ml-1.5 text-sm font-normal text-gray-500">
                                          ({getMoodScore(mood)}/5)
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatTimestamp(entry.createdAt, 'time')}
                                    </p>
                                  </div>
                                </div>
                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-gray-500">
                                  #{idx + 1}
                                </span>
                              </div>
                              {entry.notes ? (
                                <p className="mt-3 border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
                                  &ldquo;{String(entry.notes)}&rdquo;
                                </p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No mood entries for this day.</p>
                    )}
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <BeakerIcon className="h-5 w-5 text-anixi-green" />
                      <h4 className="font-semibold text-gray-900">Medication adherence</h4>
                    </div>
                    {selectedDay.medications.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedDay.medications.map((med, idx) => (
                          <li
                            key={(med.id as string) ?? idx}
                            className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5"
                          >
                            <div>
                              <p className="font-medium text-gray-900">
                                {String(med.name ?? med.medicationName ?? 'Medication')}
                              </p>
                              {med.dosage ? (
                                <p className="text-xs text-gray-500">{String(med.dosage)}</p>
                              ) : null}
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                med.taken === true
                                  ? 'bg-green-100 text-green-800'
                                  : med.taken === false
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {med.taken === true ? 'Taken' : med.taken === false ? 'Missed' : 'No record'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No medications recorded for this day.</p>
                    )}
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <HeartIcon className="h-5 w-5 text-anixi-green" />
                      <h4 className="font-semibold text-gray-900">Vitals</h4>
                    </div>
                    {selectedDay.vitals ? (
                      <div className="grid grid-cols-2 gap-3">
                        {selectedDay.vitals.heartRate != null && (
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500">Heart rate</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {String(selectedDay.vitals.heartRate)} BPM
                            </p>
                          </div>
                        )}
                        {selectedDay.vitals.bloodPressure != null && (
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500">Blood pressure</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {String((selectedDay.vitals.bloodPressure as { systolic: number }).systolic)}/
                              {String((selectedDay.vitals.bloodPressure as { diastolic: number }).diastolic)}
                            </p>
                          </div>
                        )}
                        {selectedDay.vitals.temperature != null && (
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500">Temperature</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {String(selectedDay.vitals.temperature)}°C
                            </p>
                          </div>
                        )}
                        {selectedDay.vitals.bloodSugar != null && (
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500">Blood sugar</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {String(selectedDay.vitals.bloodSugar)} mg/dL
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No vitals recorded for this day.</p>
                    )}
                  </section>

                  {!selectedDay.hasData && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      No health data recorded for this date. Encourage the patient to log their daily check-in.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="w-full rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
