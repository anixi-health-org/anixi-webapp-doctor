import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { getPracticeDailySchedule, setPracticeDailySchedule } from '../services/practiceCalendarService';
import type { AvailabilityStatus } from '../types';
import { CalendarGridView } from '../components/calendar/CalendarGridView';
import { TabPill } from '../components/ui/TabPill';

const PRACTICE_BRAND = {
  primary: '#516059',
  primaryDark: '#45524D',
  subtle: '#EEF2F0',
  border: '#C6CFCA',
};

type Tab = 'calendar' | 'daySettings';

const PracticeCalendarPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [availability, setAvailability] = useState<AvailabilityStatus>('open');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('17:00');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const practice = practiceSession?.practice;
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [miniMonth, setMiniMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!practice) return;
    const loadSchedule = async () => {
      setLoading(true);
      try {
        const schedule = await getPracticeDailySchedule(practice.id, today);
        if (schedule) {
          setAvailability(schedule.availability);
          setOpenTime(schedule.openTime || '09:00');
          setCloseTime(schedule.closeTime || '17:00');
          setNote(schedule.note || '');
        }
      } catch (error) {
        console.error('Error loading schedule:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSchedule();
  }, [practice, today]);

  const handleSave = async () => {
    if (!practice) return;
    setSaving(true);
    try {
      await setPracticeDailySchedule({
        practiceId: practice.id,
        date: today,
        availability,
        openTime: availability === 'closed' ? undefined : openTime,
        closeTime: availability === 'closed' ? undefined : closeTime,
        note: note.trim() || undefined,
      });
      setSuccessMessage('Schedule saved successfully!');
      setErrorMessage(null);
      window.setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Error saving schedule:', error);
      const msg = (error as any)?.message || String(error);
      setErrorMessage(msg || 'Error saving schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!practice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No practice found. Contact support.</p>
      </div>
    );
  }

  const miniCalendarDays = (() => {
    const year = miniMonth.getFullYear();
    const month = miniMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return { days, month, year };
  })();

  const monthTitle = miniMonth.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-anixi-beige px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-[#0E2340]">Practice Calendar</h1>
            <p className="text-sm text-[#6F7F95] mt-2">
              Manage your consultations and schedule blocks
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="inline-flex rounded-2xl bg-white border border-[#DCE4EE] p-1 shadow-sm">
              <TabPill active={activeTab === 'daySettings'} onClick={() => setActiveTab('daySettings')}>
                Day View
              </TabPill>
              <TabPill active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')}>
                Week View
              </TabPill>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#425950] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#425950]/20"
            >
              <span className="text-2xl leading-none">+</span>
              <span>Quick Add</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-6">
            <div className="rounded-[30px] border border-[#E2E8F0] bg-white shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[30px] leading-none font-semibold text-[#0E2340]">{monthTitle}</h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg text-[#8FA0B6] hover:bg-[#F4F7FA]"
                    onClick={() => setMiniMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg text-[#8FA0B6] hover:bg-[#F4F7FA]"
                    onClick={() => setMiniMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-4 text-center text-sm text-[#8FA0B6]">
                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((day) => (
                  <div key={day} className="font-semibold text-xs uppercase tracking-[0.08em]">{day}</div>
                ))}
                {miniCalendarDays.days.map((day) => {
                  const isCurrentMonth = day.getMonth() === miniCalendarDays.month;
                  const isSelected = day.toDateString() === new Date(selectedDate).toDateString();
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(day.toISOString().split('T')[0])}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                        isSelected
                          ? 'bg-[#0FA968] text-white shadow-sm'
                          : isCurrentMonth
                            ? 'text-[#8FA0B6] hover:bg-[#F4F7FA]'
                            : 'text-[#D2D8E1]'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] bg-[#2F3A39] shadow-sm p-5 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Schedule Stats</h2>
                <span className="text-emerald-400">◔</span>
              </div>
              <p className="mt-2 text-sm text-white/65">
                {new Date(selectedDate).toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">Total Slots</span>
                  <span className="font-semibold text-white">{availability === 'closed' ? 0 : 0}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-0 bg-emerald-400" />
                </div>
                <p className="text-xs text-white/45 italic">Calculated based on current month allocation.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#E2E8F0] bg-white shadow-sm p-4 sm:p-6 min-h-[720px]">
            {activeTab === 'daySettings' && (
              <div className="rounded-[24px] border border-[#E9EEF4] bg-[#FBFCFD] p-4 sm:p-6">
                <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-[#0E2340] mb-3">Availability</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { value: 'open' as const, label: 'Open', color: 'bg-[#E7FAEF] text-[#0E9F6E] border-[#CDEBD9]' },
                          { value: 'limited' as const, label: 'Limited', color: 'bg-[#FFF3DE] text-[#C47A00] border-[#F3D9A5]' },
                          { value: 'closed' as const, label: 'Closed', color: 'bg-[#FFF0F1] text-[#D6455D] border-[#F1C9CE]' },
                        ].map((option) => (
                          <label key={option.value} className="flex-1">
                            <input
                              type="radio"
                              name="availability"
                              value={option.value}
                              checked={availability === option.value}
                              onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                              className="sr-only"
                            />
                            <div
                              className={`px-4 py-3 text-sm font-semibold text-center border rounded-2xl cursor-pointer transition-colors ${
                                availability === option.value
                                  ? option.color + ' border-current'
                                  : 'bg-white text-[#6F7F95] border-[#E4EAF2] hover:bg-[#FBFCFD]'
                              }`}
                            >
                              {option.label}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {availability !== 'closed' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#0E2340] mb-2">Open Time</label>
                          <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)}
                            className="w-full text-sm border border-[#DDE5EF] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#425950]/20" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#0E2340] mb-2">Close Time</label>
                          <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)}
                            className="w-full text-sm border border-[#DDE5EF] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#425950]/20" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-[#0E2340] mb-2">Note (Optional)</label>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="Add any notes about today's schedule..." rows={4}
                        className="w-full text-sm border border-[#DDE5EF] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#425950]/20" />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 space-y-2">
                        {successMessage && (
                          <div className="text-sm text-[#0E9F6E] bg-[#E7FAEF] border border-[#CDEBD9] rounded-2xl px-4 py-3">{successMessage}</div>
                        )}
                        {errorMessage && (
                          <div className="text-sm text-[#D6455D] bg-[#FFF0F1] border border-[#F1C9CE] rounded-2xl px-4 py-3">{errorMessage}</div>
                        )}
                      </div>
                      <button onClick={handleSave} disabled={saving || loading}
                        className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: PRACTICE_BRAND.primary }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primaryDark)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primary)}>
                        {saving ? 'Saving...' : 'Save Today'}
                      </button>
                    </div>
                  </div>
              </div>
            )}

            {activeTab === 'calendar' && <CalendarGridView showCreateButton={false} showLegend={false} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeCalendarPage;
