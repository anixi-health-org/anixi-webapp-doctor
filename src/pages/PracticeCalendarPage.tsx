import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { getDoctorAppointments } from '../services/appointmentService';
import {
  getBookableBlocks,
  getAllSoftBlocks,
} from '../services/practiceSettingsService';
import type { Appointment, BookableBlock, SoftBlock } from '../types';
import { CalendarGridView } from '../components/calendar/CalendarGridView';
import { DayAgendaView } from '../components/calendar/DayAgendaView';
import {
  appointmentDateKeys,
  appointmentOnDate,
  appointmentSortMinutes,
  parseDateKey,
  toDateKey,
} from '../components/calendar/calendarDateUtils';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { AppointmentDetails } from '../components/appointments/AppointmentDetails';

type Tab = 'day' | 'week';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatClock = (hhmm: string) => {
  const [hRaw, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(m)) return hhmm;
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDateTime = (d: Date) =>
  d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const overlapsDay = (block: SoftBlock, day: Date) => {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return block.startAt < dayEnd && block.endAt > dayStart;
};

const PracticeCalendarPage: React.FC = () => {
  const { practiceSession, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('day');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts] = useState(false);
  const [selectedDayAppointment, setSelectedDayAppointment] = useState<Appointment | null>(null);
  const [calendarReloadToken, setCalendarReloadToken] = useState(0);
  const [clinicHours, setClinicHours] = useState<BookableBlock[]>([]);
  const [softBlocks, setSoftBlocks] = useState<SoftBlock[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);

  const practice = practiceSession?.practice;
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [miniMonth, setMiniMonth] = useState<Date>(new Date());

  const loadPracticeSchedule = useCallback(async () => {
    if (!practice?.id || !user?.id) return;
    setLoadingHours(true);
    try {
      const [blocks, soft] = await Promise.all([
        getBookableBlocks(practice.id),
        getAllSoftBlocks(practice.id),
      ]);
      setClinicHours(blocks.filter((b) => b.doctorId === user.id && b.active !== false));
      setSoftBlocks(soft.filter((b) => b.doctorId === user.id));
    } catch {
      setClinicHours([]);
      setSoftBlocks([]);
    } finally {
      setLoadingHours(false);
    }
  }, [practice?.id, user?.id]);

  useEffect(() => {
    void loadPracticeSchedule();
  }, [loadPracticeSchedule, calendarReloadToken]);

  const loadAppointments = useCallback(async () => {
    if (!user?.id) return;
    setLoadingApts(true);
    try {
      const all = await getDoctorAppointments(user.id);
      setAllAppointments(all);
    } catch {
      setAllAppointments([]);
    } finally {
      setLoadingApts(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments, calendarReloadToken]);

  const selectedDay = useMemo(() => parseDateKey(selectedDate), [selectedDate]);
  const selectedDow = selectedDay.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const dayClinicHours = useMemo(
    () =>
      clinicHours
        .filter((b) => b.dayOfWeek === selectedDow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [clinicHours, selectedDow]
  );

  const dayBlockedTime = useMemo(
    () =>
      softBlocks
        .filter((b) => overlapsDay(b, selectedDay))
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
    [softBlocks, selectedDay]
  );

  const dayAppointments = useMemo(
    () =>
      allAppointments
        .filter((a) => appointmentOnDate(a, selectedDate))
        .sort((a, b) => appointmentSortMinutes(a) - appointmentSortMinutes(b)),
    [allAppointments, selectedDate]
  );

  const appointmentDates = useMemo(() => {
    const set = new Set<string>();
    allAppointments.forEach((a) => {
      if (a.status === 'cancelled') return;
      appointmentDateKeys(a).forEach((k) => set.add(k));
    });
    return set;
  }, [allAppointments]);

  const selectedLabel = selectedDay.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleSelectAppointment = (apt: Appointment) => {
    const isAnixi =
      !apt.isManual && apt.patientId && apt.patientId !== 'manual' && apt.patientId !== 'unknown';
    if (isAnixi) {
      navigate(`/patient-profile/${apt.patientId}`, {
        state: {
          appointmentId: apt.id,
          consultType: apt.consultType,
          status: apt.status,
          appointmentTime: apt.time,
        },
      });
    } else {
      setSelectedDayAppointment(apt);
    }
  };

  if (!practice) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[#65758b]">No practice found. Contact support.</p>
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

  const active = dayAppointments.filter((a) => a.status !== 'cancelled');
  const confirmed = dayAppointments.filter((a) => a.status === 'confirmed').length;
  const pending = dayAppointments.filter((a) => a.status === 'pending').length;
  const completed = dayAppointments.filter((a) => a.status === 'completed').length;
  const ratio = active.length > 0 ? Math.round((confirmed / active.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">Practice calendar</h1>
            <p className="mt-1 text-[13px] text-[#65758b]">
              See who is booked today, and scan the full week when you need it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl bg-[#e8eef4] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('day')}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-[13px] ${
                  activeTab === 'day'
                    ? 'bg-white text-[#0E2340] shadow-sm'
                    : 'text-[#65758b] hover:text-[#344256]'
                }`}
              >
                Day view
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('week')}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-[13px] ${
                  activeTab === 'week'
                    ? 'bg-white text-[#0E2340] shadow-sm'
                    : 'text-[#65758b] hover:text-[#344256]'
                }`}
              >
                Week view
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
            >
              <span className="text-lg leading-none">+</span>
              Quick add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#e1e7ef] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0E2340]">{monthTitle}</h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8FA0B6] transition hover:bg-[#f0f4f8] hover:text-[#0E2340]"
                    onClick={() =>
                      setMiniMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8FA0B6] transition hover:bg-[#f0f4f8] hover:text-[#0E2340]"
                    onClick={() =>
                      setMiniMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center text-sm text-[#8FA0B6]">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <div key={day} className="text-[10px] font-semibold uppercase tracking-wider">
                    {day}
                  </div>
                ))}
                {miniCalendarDays.days.map((day) => {
                  const isCurrentMonth = day.getMonth() === miniCalendarDays.month;
                  const dayKey = toDateKey(day);
                  const isSelected = dayKey === selectedDate;
                  const isToday = dayKey === today;
                  const hasAppts = appointmentDates.has(dayKey);
                  return (
                    <button
                      key={dayKey + String(isCurrentMonth)}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dayKey);
                        setActiveTab('day');
                      }}
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition ${
                        isSelected
                          ? 'bg-anixi-green font-semibold text-white'
                          : isToday
                            ? 'font-semibold text-anixi-green ring-1 ring-anixi-green/40'
                            : isCurrentMonth
                              ? 'text-[#0E2340] hover:bg-[#f0f4f8]'
                              : 'text-[#c5cdd8]'
                      }`}
                    >
                      <span className="relative">
                        {day.getDate()}
                        {hasAppts && !isSelected && (
                          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-anixi-green" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#e1e7ef] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                Schedule stats
              </p>
              <p className="mt-1 text-[12px] text-[#65758b]">{selectedLabel}</p>
              {loadingApts ? (
                <p className="mt-3 text-[13px] text-[#8FA0B6]">Loading…</p>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total', value: active.length },
                      { label: 'Confirmed', value: confirmed },
                      { label: 'Pending', value: pending },
                      { label: 'Completed', value: completed },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-[#eef2f6] bg-[#f8fafc] px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                          {stat.label}
                        </p>
                        <p className="mt-0.5 text-lg font-bold text-[#0E2340]">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#94a3b8]">
                    {active.length === 0
                      ? 'No visits on this day'
                      : `${ratio}% confirmed · ${active.length} visit${active.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-[640px] rounded-xl border border-[#e1e7ef] bg-white p-4 shadow-sm sm:p-5">
            {activeTab === 'day' && (
              <div className="space-y-5">
                <DayAgendaView
                  dateLabel={selectedLabel}
                  appointments={dayAppointments}
                  isLoading={loadingApts}
                  onSelectAppointment={handleSelectAppointment}
                  onQuickAdd={() => setShowCreateModal(true)}
                />

                <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0E2340]">Clinic hours</p>
                      <p className="mt-0.5 text-[12px] text-[#65758b]">
                        From Settings · {DAY_LABELS[selectedDow]}s
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/practice-settings?tab=availability')}
                      className="shrink-0 text-xs font-semibold text-anixi-green hover:underline"
                    >
                      Manage in Settings
                    </button>
                  </div>

                  {loadingHours ? (
                    <p className="mt-3 text-[13px] text-[#8FA0B6]">Loading clinic hours…</p>
                  ) : dayClinicHours.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-[#e1e7ef] bg-white px-3.5 py-3">
                      <p className="text-[13px] font-medium text-[#0E2340]">
                        No clinic hours on {DAY_LABELS[selectedDow]}s
                      </p>
                      <p className="mt-1 text-[12px] text-[#65758b]">
                        Patients cannot book this day until you add hours in Settings.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dayClinicHours.map((block) => (
                        <li
                          key={block.id}
                          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
                        >
                          <p className="text-[13px] font-semibold text-emerald-900">
                            {formatClock(block.startTime)} – {formatClock(block.endTime)}
                          </p>
                          <p className="text-[11px] text-emerald-800/80">
                            {block.slotDurationMinutes}-min slots
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0E2340]">Blocked time</p>
                      <p className="mt-0.5 text-[12px] text-[#65758b]">
                        From Settings · not bookable for patients
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/practice-settings?tab=soft-blocks')}
                      className="shrink-0 text-xs font-semibold text-anixi-green hover:underline"
                    >
                      Manage in Settings
                    </button>
                  </div>

                  {loadingHours ? (
                    <p className="mt-3 text-[13px] text-[#8FA0B6]">Loading blocked time…</p>
                  ) : dayBlockedTime.length === 0 ? (
                    <p className="mt-3 text-[13px] text-[#65758b]">No blocked time on this day.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dayBlockedTime.map((block) => (
                        <li
                          key={block.id}
                          className="rounded-lg border border-[#e1e7ef] bg-white px-3 py-2"
                        >
                          <p className="text-[13px] font-semibold text-[#0E2340]">{block.title}</p>
                          <p className="mt-0.5 text-[12px] text-[#65758b]">
                            {formatDateTime(block.startAt)} – {formatDateTime(block.endAt)}
                            {block.category ? ` · ${block.category.replace(/_/g, ' ')}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'week' && (
              <CalendarGridView
                showCreateButton={false}
                showLegend={false}
                focusDate={selectedDate}
                reloadToken={calendarReloadToken}
              />
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onAppointmentCreated={async () => {
            setCalendarReloadToken((t) => t + 1);
            await loadAppointments();
            setShowCreateModal(false);
          }}
        />
      )}

      {selectedDayAppointment && (
        <AppointmentDetails
          appointment={selectedDayAppointment}
          onClose={() => setSelectedDayAppointment(null)}
          onStatusChange={() => {
            setSelectedDayAppointment(null);
            setCalendarReloadToken((t) => t + 1);
          }}
          onReschedule={async () => {
            setCalendarReloadToken((t) => t + 1);
            await loadAppointments();
            setSelectedDayAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default PracticeCalendarPage;
