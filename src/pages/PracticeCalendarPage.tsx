import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { getPracticeDailySchedule, setPracticeDailySchedule } from '../services/practiceCalendarService';
import type { AvailabilityStatus } from '../types';
import { CalendarGridView } from '../components/calendar/CalendarGridView';

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

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Practice Calendar</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex border-b border-gray-200 mb-6 gap-0">
        {([
          { id: 'calendar' as const, label: 'Week View' },
          { id: 'daySettings' as const, label: 'Day Settings' },
        ] as { id: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#516059] text-[#516059]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'calendar' && <CalendarGridView />}

      {activeTab === 'daySettings' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Today's Schedule</h2>
                <p className="text-sm text-gray-600">{new Date().toLocaleDateString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Availability</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: 'open' as const, label: 'Open', color: 'bg-green-100 text-green-800 border-green-200' },
                    { value: 'limited' as const, label: 'Limited', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                    { value: 'closed' as const, label: 'Closed', color: 'bg-red-100 text-red-800 border-red-200' },
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
                        className={`px-4 py-2 text-sm font-medium text-center border rounded-lg cursor-pointer transition-colors ${
                          availability === option.value
                            ? option.color + ' border-current'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Open Time</label>
                    <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Close Time</label>
                    <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (Optional)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Add any notes about today's schedule..." rows={3}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059]" />
              </div>
              <div className="flex justify-end items-start gap-4">
                <div className="flex-1">
                  {successMessage && (
                    <div className="text-sm text-green-800 bg-green-50 border border-green-100 rounded px-3 py-2">{successMessage}</div>
                  )}
                  {errorMessage && (
                    <div className="text-sm text-red-800 bg-red-50 border border-red-100 rounded px-3 py-2">{errorMessage}</div>
                  )}
                </div>
                <button onClick={handleSave} disabled={saving || loading}
                  className="px-6 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: PRACTICE_BRAND.primary }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primaryDark)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PRACTICE_BRAND.primary)}>
                  {saving ? 'Saving...' : 'Save Today'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeCalendarPage;
