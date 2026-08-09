import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useClinicSetupStatus } from '../../hooks/useClinicSetupStatus';
import { getPracticeWideAppointments } from '../../services/appointmentService';
import {
  getBookableBlocks,
  listPracticeClinicians,
} from '../../services/practiceSettingsService';
import { memberDisplayLabel } from '../../services/practiceMemberService';
import type { Appointment, BookableBlock, PracticeMember } from '../../types';
import { AppointmentList } from '../../components/appointments/AppointmentList';
import { CreateAppointmentModal } from '../../components/appointments/CreateAppointmentModal';
import { AppointmentDetails } from '../../components/appointments/AppointmentDetails';
import { ClinicAdminSetupBanner } from '../../components/clinic/ClinicAdminSetupBanner';
import { DayAgendaView } from '../../components/calendar/DayAgendaView';
import { toDateKey, parseDateKey } from '../../components/calendar/calendarDateUtils';
import { Toast, AppointmentsPageSkeleton } from '../../components/ui';
import { PageHeader, PageShell } from '../../components/page-layout';
import { TabPill } from '../../components/ui/TabPill';
import clsx from 'clsx';

type FilterType = Appointment['status'] | 'All' | 'Today';
type ViewTab = 'list' | 'calendar';

export const ClinicAdminSchedulePage: React.FC = () => {
  const { practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const practiceId = practice?.id;
  const setup = useClinicSetupStatus(practiceId);
  const canBook = can('manageAppointments');

  const [viewTab, setViewTab] = useState<ViewTab>('list');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [bookableBlocks, setBookableBlocks] = useState<BookableBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Appointment['status'] | 'All'>('All');
  const [selectedCard, setSelectedCard] = useState<FilterType | null>('Today');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const reload = useCallback(async () => {
    if (!practiceId) return;
    setIsLoading(true);
    try {
      const [appts, cliniciansList, blocks] = await Promise.all([
        getPracticeWideAppointments(practiceId),
        listPracticeClinicians(practiceId),
        getBookableBlocks(practiceId),
      ]);
      setAppointments(appts);
      setClinicians(cliniciansList);
      setBookableBlocks(blocks);
    } finally {
      setIsLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const doctorFiltered = useMemo(() => {
    if (selectedDoctorId === 'all') return appointments;
    return appointments.filter((a) => a.doctorId === selectedDoctorId);
  }, [appointments, selectedDoctorId]);

  const stats = {
    total: doctorFiltered.filter((a) => a.status !== 'cancelled' && a.status !== 'completed').length,
    confirmed: doctorFiltered.filter((a) => a.status === 'confirmed').length,
    pending: doctorFiltered.filter((a) => a.status === 'pending').length,
    completed: doctorFiltered.filter((a) => a.status === 'completed').length,
    cancelled: doctorFiltered.filter((a) => a.status === 'cancelled').length,
    today: doctorFiltered.filter((a) => {
      const today = new Date();
      const appointmentDate = new Date(a.date);
      return (
        appointmentDate.getFullYear() === today.getFullYear() &&
        appointmentDate.getMonth() === today.getMonth() &&
        appointmentDate.getDate() === today.getDate() &&
        a.status !== 'cancelled' &&
        a.status !== 'completed'
      );
    }).length,
  };

  const handleCardClick = (card: FilterType) => {
    setSelectedCard(card);
    if (card === 'All') {
      setFilterStatus('All');
    } else if (card === 'Today') {
      setFilterStatus('All');
    } else {
      setFilterStatus(card as Appointment['status']);
    }
  };

  const baseAppointments =
    selectedCard === 'cancelled' || selectedCard === 'completed'
      ? doctorFiltered
      : doctorFiltered.filter((a) => a.status !== 'cancelled' && a.status !== 'completed');

  let filteredAppointments: Appointment[] = [];
  if (selectedCard === 'Today') {
    const today = new Date();
    filteredAppointments = baseAppointments.filter((a) => {
      const appointmentDate = new Date(a.date);
      return (
        appointmentDate.getFullYear() === today.getFullYear() &&
        appointmentDate.getMonth() === today.getMonth() &&
        appointmentDate.getDate() === today.getDate()
      );
    });
  } else if (selectedCard && selectedCard !== 'All') {
    filteredAppointments = baseAppointments.filter((a) => a.status === selectedCard);
  } else if (selectedCard === 'All') {
    filteredAppointments = baseAppointments;
  } else if ((filterStatus as string) === 'All') {
    filteredAppointments = baseAppointments;
  } else {
    filteredAppointments = baseAppointments.filter((a) => a.status === filterStatus);
  }

  const calendarDay = useMemo(() => parseDateKey(selectedDate), [selectedDate]);
  const calendarDayAppointments = useMemo(
    () =>
      doctorFiltered.filter((a) => {
        const d = new Date(a.date);
        return (
          d.getFullYear() === calendarDay.getFullYear() &&
          d.getMonth() === calendarDay.getMonth() &&
          d.getDate() === calendarDay.getDate()
        );
      }),
    [doctorFiltered, calendarDay]
  );

  const doctorHoursForDay = useMemo(() => {
    const dow = calendarDay.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const relevantDoctorIds =
      selectedDoctorId === 'all' ? clinicians.map((c) => c.uid) : [selectedDoctorId];
    return bookableBlocks.filter(
      (b) =>
        b.dayOfWeek === dow &&
        b.active !== false &&
        relevantDoctorIds.includes(b.doctorId)
    );
  }, [bookableBlocks, calendarDay, clinicians, selectedDoctorId]);

  const weekDays = useMemo(() => {
    const base = parseDateKey(selectedDate);
    const day = base.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const appointmentsOnDay = useCallback(
    (day: Date) =>
      doctorFiltered.filter((a) => {
        const d = new Date(a.date);
        return (
          d.getFullYear() === day.getFullYear() &&
          d.getMonth() === day.getMonth() &&
          d.getDate() === day.getDate()
        );
      }).length,
    [doctorFiltered]
  );

  const doctorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    clinicians.forEach((c) => {
      map.set(c.uid, memberDisplayLabel(c, practice?.ownerId));
    });
    return map;
  }, [clinicians, practice?.ownerId]);

  const doctorLabelsRecord = useMemo(() => {
    const record: Record<string, string> = {};
    doctorLabelById.forEach((label, id) => {
      record[id] = label;
    });
    return record;
  }, [doctorLabelById]);

  if (isLoading && appointments.length === 0) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <AppointmentsPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <PageHeader
        title="Schedule"
        description="Book appointments and view calendars across your clinic's doctors."
        actions={
          canBook ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={setup.doctorCount === 0}
              className="inline-flex h-10 items-center rounded-lg bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#365c4f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              + New appointment
            </button>
          ) : undefined
        }
      />

      {!setup.loading && !setup.isReady && (
        <ClinicAdminSetupBanner steps={setup.steps} className="mb-6" />
      )}

      {clinicians.length === 0 && !isLoading && (
        <div className="mb-6 rounded-2xl border border-[#e1e7ef] bg-white p-5">
          <p className="text-sm font-semibold text-[#344256]">No doctors on the team yet</p>
          <p className="mt-1 text-sm text-[#65758b]">
            Invite doctors before you can book appointments or manage calendars.
          </p>
          <Link
            to="/clinic/team"
            className="mt-3 inline-flex text-sm font-semibold text-anixi-green hover:underline"
          >
            Go to Team & doctors →
          </Link>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <TabPill active={viewTab === 'list'} onClick={() => setViewTab('list')}>
            List
          </TabPill>
          <TabPill active={viewTab === 'calendar'} onClick={() => setViewTab('calendar')}>
            Day calendar
          </TabPill>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="doctor-filter" className="text-sm font-medium text-[#65758b]">
            Doctor
          </label>
          <select
            id="doctor-filter"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
          >
            <option value="all">All doctors</option>
            {clinicians.map((c) => (
              <option key={c.uid} value={c.uid}>
                {memberDisplayLabel(c, practice?.ownerId)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {viewTab === 'list' && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: 'total' as const, label: 'Total', icon: ClipboardList, value: stats.total },
              { key: 'confirmed' as const, label: 'Confirmed', icon: CheckCircle2, value: stats.confirmed },
              { key: 'pending' as const, label: 'Pending', icon: Clock, value: stats.pending },
              { key: 'completed' as const, label: 'Completed', icon: Clock, value: stats.completed },
              { key: 'cancelled' as const, label: 'Cancelled', icon: XCircle, value: stats.cancelled },
              { key: 'today' as const, label: 'Today', icon: Calendar, value: stats.today },
            ].map(({ key, label, icon: Icon, value }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleCardClick(key === 'total' ? 'All' : key === 'today' ? 'Today' : key)}
                className={`rounded-xl border bg-white p-4 text-left transition hover:border-anixi-green/40 ${
                  selectedCard === (key === 'total' ? 'All' : key === 'today' ? 'Today' : key)
                    ? 'border-anixi-green ring-1 ring-anixi-green/30'
                    : 'border-[#e1e7ef]'
                }`}
              >
                <Icon className="mb-2 h-5 w-5 text-[#8FA0B6]" />
                <p className="text-2xl font-bold text-[#344256]">{value}</p>
                <p className="text-xs text-[#65758b]">{label}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(['All', 'confirmed', 'pending', 'completed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setFilterStatus(status);
                  setSelectedCard(status === 'All' ? 'All' : status);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  filterStatus === status
                    ? 'bg-anixi-green text-white'
                    : 'bg-white text-[#65758b] border border-[#e1e7ef]'
                }`}
              >
                {status === 'All' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <AppointmentList
              appointments={filteredAppointments}
              pageSize={10}
              onSelectAppointment={setSelectedAppointment}
              isLoading={isLoading}
              showDoctor={selectedDoctorId === 'all'}
              doctorLabels={doctorLabelsRecord}
            />
          </div>
        </>
      )}

      {viewTab === 'calendar' && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const key = toDateKey(day);
              const isSelected = key === selectedDate;
              const isToday = key === toDateKey(new Date());
              const count = appointmentsOnDay(day);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={clsx(
                    'rounded-xl border px-2 py-3 text-center transition',
                    isSelected
                      ? 'border-anixi-green bg-anixi-green/10 ring-1 ring-anixi-green/30'
                      : 'border-[#e1e7ef] bg-white hover:border-anixi-green/40'
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                    {day.toLocaleDateString('en-ZA', { weekday: 'short' })}
                  </p>
                  <p
                    className={clsx(
                      'mt-1 text-lg font-bold',
                      isToday ? 'text-anixi-green' : 'text-[#344256]'
                    )}
                  >
                    {day.getDate()}
                  </p>
                  {count > 0 && (
                    <p className="mt-1 text-[10px] font-medium text-anixi-green">{count} appt</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="rounded-xl border border-[#e1e7ef] bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-[#344256]">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
            />
            {doctorHoursForDay.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  Clinic hours
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[#65758b]">
                  {doctorHoursForDay.map((b) => (
                    <li key={b.id}>
                      {selectedDoctorId === 'all' && (
                        <span className="font-medium text-[#344256]">
                          {doctorLabelById.get(b.doctorId) || 'Doctor'}:{' '}
                        </span>
                      )}
                      {b.startTime} – {b.endTime}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link
              to="/clinic/settings?tab=schedules"
              className="mt-4 inline-block text-xs font-semibold text-anixi-green hover:underline"
            >
              Edit doctor schedules →
            </Link>
            {clinicians.length === 0 && (
              <p className="mt-4 text-sm text-amber-700">
                Invite doctors to manage their calendars from Clinic settings.
              </p>
            )}
          </div>
          <DayAgendaView
            dateLabel={calendarDay.toLocaleDateString('en-ZA', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            appointments={calendarDayAppointments}
            isLoading={isLoading}
            onSelectAppointment={setSelectedAppointment}
            onQuickAdd={canBook ? () => setShowCreateModal(true) : undefined}
            showDoctor={selectedDoctorId === 'all'}
            doctorLabels={doctorLabelsRecord}
          />
          </div>
        </div>
      )}

      {showCreateModal && canBook && (
        <CreateAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onAppointmentCreated={(message) => {
            setShowCreateModal(false);
            void reload();
            if (message) {
              setToast({ visible: true, message, type: 'success' });
            }
          }}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => {
            setSelectedAppointment(null);
            void reload();
          }}
        />
      )}
    </PageShell>
  );
};

export default ClinicAdminSchedulePage;
