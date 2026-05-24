import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { getPracticeDailySchedule, setPracticeDailySchedule } from '../services/practiceCalendarService';
import { getDoctorAppointments } from '../services/appointmentService';
import type { AvailabilityStatus } from '../types';
import { Appointment } from '../types';
import { CalendarGridView } from '../components/calendar/CalendarGridView';
import { TabPill } from '../components/ui/TabPill';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { AppointmentDetails } from '../components/appointments/AppointmentDetails';

const PRACTICE_BRAND = {
  primary: '#516059',
  primaryDark: '#45524D',
  subtle: '#EEF2F0',
  border: '#C6CFCA',
};

type Tab = 'calendar' | 'daySettings';

const PracticeCalendarPage: React.FC = () => {
  const { practiceSession, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [availability, setAvailability] = useState<AvailabilityStatus>('open');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('17:00');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [loadingDayApts, setLoadingDayApts] = useState(false);
  const [selectedDayAppointment, setSelectedDayAppointment] = useState<Appointment | null>(null);

  const practice = practiceSession?.practice;
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [miniMonth, setMiniMonth] = useState<Date>(new Date());

  // Reload availability settings whenever the selected date changes
  useEffect(() => {
    if (!practice) return;
    const loadSchedule = async () => {
      setLoading(true);
      try {
        const schedule = await getPracticeDailySchedule(practice.id, selectedDate);
        if (schedule) {
          setAvailability(schedule.availability);
          setOpenTime(schedule.openTime || '09:00');
          setCloseTime(schedule.closeTime || '17:00');
          setNote(schedule.note || '');
        } else {
          setAvailability('open');
          setOpenTime('09:00');
          setCloseTime('17:00');
          setNote('');
        }
      } catch (error) {
        console.error('Error loading schedule:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSchedule();
  }, [practice, selectedDate]);

  // Load appointments for the selected date (Day View operational list)
  const loadDayAppointments = useCallback(async () => {
    if (!user?.id) return;
    setLoadingDayApts(true);
    try {
      const all = await getDoctorAppointments(user.id);
      const sel = new Date(selectedDate);
      const filtered = all
        .filter((a) => {
          const d = new Date(a.date);
          return (
            d.getFullYear() === sel.getFullYear() &&
            d.getMonth() === sel.getMonth() &&
            d.getDate() === sel.getDate()
          );
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setDayAppointments(filtered);
    } catch {
      setDayAppointments([]);
    } finally {
      setLoadingDayApts(false);
    }
  }, [user?.id, selectedDate]);

  useEffect(() => { loadDayAppointments(); }, [loadDayAppointments]);

  const handleSave = async () => {
    if (!practice) return;
    setSaving(true);
    try {
      await setPracticeDailySchedule({
        practiceId: practice.id,
        date: selectedDate,
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
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#425950] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#425950]/20 hover:bg-[#374d45] transition-colors"
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
              {loadingDayApts ? (
                <p className="mt-4 text-xs text-white/40">Loading…</p>
              ) : (() => {
                const active = dayAppointments.filter((a) => a.status !== 'cancelled');
                const confirmed = dayAppointments.filter((a) => a.status === 'confirmed').length;
                const pending = dayAppointments.filter((a) => a.status === 'pending').length;
                const completed = dayAppointments.filter((a) => a.status === 'completed').length;
                const ratio = active.length > 0 ? Math.round((confirmed / active.length) * 100) : 0;
                return (
                  <div className="mt-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/60">Total</span>
                      <span className="font-semibold text-white">{active.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/60">Confirmed</span>
                      <span className="font-semibold text-emerald-400">{confirmed}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/60">Pending</span>
                      <span className="font-semibold text-amber-300">{pending}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/60">Completed</span>
                      <span className="font-semibold text-white/80">{completed}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-400 transition-all" style={{ width: `${ratio}%` }} />
                    </div>
                    <p className="text-xs text-white/40">{ratio}% confirmed</p>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#E2E8F0] bg-white shadow-sm p-4 sm:p-6 min-h-[720px]">
            {activeTab === 'daySettings' && (
              <div className="space-y-6">
                {/* Availability settings */}
                <div className="rounded-[24px] border border-[#E9EEF4] bg-[#FBFCFD] p-4 sm:p-6">
                  <h3 className="text-sm font-semibold text-[#0E2340] mb-4">Availability Settings</h3>
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
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Operational day schedule */}
                <div className="rounded-[24px] border border-[#E9EEF4] bg-white p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#0E2340]">
                      Schedule — {new Date(selectedDate).toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    {loadingDayApts && <span className="text-xs text-[#8FA0B6]">Loading…</span>}
                  </div>
                  {!loadingDayApts && dayAppointments.length === 0 && (
                    <p className="text-sm text-[#8FA0B6] italic">No appointments scheduled for this day.</p>
                  )}
                  <div className="space-y-2">
                    {dayAppointments
                      .filter((a) => a.status !== 'cancelled')
                      .map((apt) => {
                        const isAnixi = !apt.isManual && apt.patientId && apt.patientId !== 'manual' && apt.patientId !== 'unknown';
                        const statusColors: Record<string, string> = {
                          confirmed: 'border-l-emerald-400 bg-emerald-50',
                          pending: 'border-l-amber-400 bg-amber-50',
                          completed: 'border-l-gray-400 bg-gray-50',
                          no_show: 'border-l-orange-400 bg-orange-50',
                        };
                        const colorClass = statusColors[apt.status] ?? 'border-l-gray-300 bg-gray-50';
                        return (
                          <button
                            key={apt.id}
                            type="button"
                            onClick={() => {
                              if (isAnixi) {
                                navigate(`/patient-profile/${apt.patientId}`, {
                                  state: { appointmentId: apt.id, consultType: apt.consultType, status: apt.status },
                                });
                              } else {
                                setSelectedDayAppointment(apt);
                              }
                            }}
                            className={`w-full text-left border-l-4 rounded-r-xl px-4 py-3 transition-colors hover:brightness-95 ${colorClass}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#0E2340] truncate">{apt.patientName}</span>
                              <span className="text-xs text-[#6F7F95] shrink-0">{apt.time}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-[#8FA0B6] capitalize">{apt.consultType ?? apt.type}</span>
                              {apt.isManual && <span className="text-[10px] text-[#8FA0B6]">manual</span>}
                              {isAnixi && <span className="text-[10px] text-[#0FA968]">Anixi → Profile</span>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'calendar' && <CalendarGridView showCreateButton={false} showLegend={false} />}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onAppointmentCreated={async (message) => {
            await loadDayAppointments();
            setShowCreateModal(false);
          }}
        />
      )}

      {selectedDayAppointment && (
        <AppointmentDetails
          appointment={selectedDayAppointment}
          onClose={() => setSelectedDayAppointment(null)}
          onStatusChange={(id, status) => {
            setDayAppointments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, status } : a))
            );
            setSelectedDayAppointment(null);
          }}
          onReschedule={async () => {
            await loadDayAppointments();
            setSelectedDayAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default PracticeCalendarPage;
