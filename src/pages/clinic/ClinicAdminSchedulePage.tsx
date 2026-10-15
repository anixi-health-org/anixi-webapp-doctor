import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { ClinicAppointmentSheet } from '../../components/clinic/ClinicAppointmentSheet';
import { ClinicAdminSetupBanner } from '../../components/clinic/ClinicAdminSetupBanner';
import { DayAgendaView } from '../../components/calendar/DayAgendaView';
import { toDateKey, parseDateKey, asDate } from '../../components/calendar/calendarDateUtils';
import { Toast, AppointmentsPageSkeleton } from '../../components/ui';
import { PageHeader, PageShell } from '../../components/page-layout';
import { TabBar, TabPill } from '../../components/ui/TabPill';
import clsx from 'clsx';

type ViewTab = 'list' | 'day';
type ListFilter = 'upcoming' | 'today' | 'confirmed' | 'pending' | 'completed' | 'cancelled';

const LIST_FILTERS: { key: ListFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Waiting' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function appointmentDayKey(appointment: Appointment): string {
  const day =
    asDate(appointment.startAt) || asDate(appointment.date) || asDate(appointment.scheduledAt);
  return day ? toDateKey(day) : '';
}

function isClosedVisit(status: Appointment['status']): boolean {
  return (
    status === 'cancelled' ||
    status === 'auto_cancelled' ||
    status === 'completed' ||
    status === 'no_show'
  );
}

function filterScheduleAppointments(
  appointments: Appointment[],
  filter: ListFilter,
  todayKey: string,
): Appointment[] {
  switch (filter) {
    case 'today':
      return appointments.filter(
        (appointment) =>
          appointmentDayKey(appointment) === todayKey &&
          appointment.status !== 'cancelled' &&
          appointment.status !== 'auto_cancelled',
      );
    case 'upcoming':
      return appointments.filter((appointment) => !isClosedVisit(appointment.status));
    case 'confirmed':
      return appointments.filter((appointment) => appointment.status === 'confirmed');
    case 'pending':
      return appointments.filter(
        (appointment) => appointment.status === 'pending' || appointment.status === 'rescheduled',
      );
    case 'completed':
      return appointments.filter((appointment) => appointment.status === 'completed');
    case 'cancelled':
      return appointments.filter(
        (appointment) =>
          appointment.status === 'cancelled' ||
          appointment.status === 'auto_cancelled' ||
          appointment.status === 'no_show',
      );
    default:
      return appointments;
  }
}

function sortByStart(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((left, right) => {
    const leftTime =
      asDate(left.startAt) || asDate(left.scheduledAt) || asDate(left.date);
    const rightTime =
      asDate(right.startAt) || asDate(right.scheduledAt) || asDate(right.date);
    return (leftTime?.getTime() || 0) - (rightTime?.getTime() || 0);
  });
}

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
  const [listFilter, setListFilter] = useState<ListFilter>('upcoming');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const reload = useCallback(async () => {
    if (!practiceId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [appts, cliniciansList, blocks] = await Promise.all([
        getPracticeWideAppointments(practiceId),
        listPracticeClinicians(practiceId),
        getBookableBlocks(practiceId),
      ]);
      setAppointments(appts);
      setClinicians(cliniciansList);
      setBookableBlocks(blocks);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the clinic schedule.');
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

  useEffect(() => {
    if (selectedDoctorId === 'all') return;
    if (!clinicians.some((clinician) => clinician.uid === selectedDoctorId)) {
      setSelectedDoctorId('all');
    }
  }, [clinicians, selectedDoctorId]);

  const clinicianIds = useMemo(
    () => new Set(clinicians.map((clinician) => clinician.uid)),
    [clinicians],
  );

  const clinicianAppointments = useMemo(
    () => appointments.filter((appointment) => clinicianIds.has(appointment.doctorId)),
    [appointments, clinicianIds],
  );

  const doctorFiltered = useMemo(() => {
    if (selectedDoctorId === 'all') return clinicianAppointments;
    return clinicianAppointments.filter((appointment) => appointment.doctorId === selectedDoctorId);
  }, [clinicianAppointments, selectedDoctorId]);

  const todayKey = toDateKey(new Date());
  const filteredAppointments = useMemo(
    () => sortByStart(filterScheduleAppointments(doctorFiltered, listFilter, todayKey)),
    [doctorFiltered, listFilter, todayKey],
  );
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        LIST_FILTERS.map((item) => [
          item.key,
          filterScheduleAppointments(doctorFiltered, item.key, todayKey).length,
        ]),
      ) as Record<ListFilter, number>,
    [doctorFiltered, todayKey],
  );

  const calendarDay = useMemo(() => parseDateKey(selectedDate), [selectedDate]);
  const calendarDayAppointments = useMemo(
    () =>
      sortByStart(
        doctorFiltered.filter((appointment) => appointmentDayKey(appointment) === toDateKey(calendarDay)),
      ),
    [doctorFiltered, calendarDay],
  );

  const doctorHoursForDay = useMemo(() => {
    const dow = calendarDay.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const relevantDoctorIds =
      selectedDoctorId === 'all' ? clinicians.map((clinician) => clinician.uid) : [selectedDoctorId];
    return bookableBlocks.filter(
      (block) =>
        block.dayOfWeek === dow &&
        block.active !== false &&
        relevantDoctorIds.includes(block.doctorId),
    );
  }, [bookableBlocks, calendarDay, clinicians, selectedDoctorId]);

  const weekDays = useMemo(() => {
    const base = parseDateKey(selectedDate);
    const day = base.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      return next;
    });
  }, [selectedDate]);

  const appointmentsOnDay = useCallback(
    (day: Date) =>
      doctorFiltered.filter((appointment) => appointmentDayKey(appointment) === toDateKey(day)).length,
    [doctorFiltered],
  );

  const doctorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    clinicians.forEach((clinician) => {
      map.set(clinician.uid, memberDisplayLabel(clinician, practice?.ownerId));
    });
    return map;
  }, [clinicians, practice?.ownerId]);

  const doctorLabelsRecord = useMemo(() => {
    const record: Record<string, string> = {};
    doctorLabelById.forEach((label, id) => {
      record[id] = label;
    });
    clinicianAppointments.forEach((appointment) => {
      if (appointment.doctorName && !record[appointment.doctorId]) {
        record[appointment.doctorId] = appointment.doctorName;
      }
    });
    return record;
  }, [clinicianAppointments, doctorLabelById]);

  const selectedClinicianName =
    selectedDoctorId === 'all'
      ? null
      : doctorLabelById.get(selectedDoctorId) || 'this clinician';

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
        description="See who is booked with your clinicians, then open a visit or add a new one."
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

      {loadError ? (
        <p className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      {clinicians.length === 0 && !isLoading && (
        <div className="mb-6 rounded-2xl border border-[#e1e7ef] bg-white p-5">
          <p className="text-sm font-semibold text-[#344256]">No clinicians on the team yet</p>
          <p className="mt-1 text-sm text-[#65758b]">
            Invite a doctor, nurse, or other clinician before you can book visits. Administrators and
            reception staff do not appear here.
          </p>
          <Link
            to="/clinic/team"
            className="mt-3 inline-flex text-sm font-semibold text-anixi-green hover:underline"
          >
            Go to Team & doctors
          </Link>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TabBar>
          <TabPill active={viewTab === 'list'} onClick={() => setViewTab('list')}>
            List
          </TabPill>
          <TabPill active={viewTab === 'day'} onClick={() => setViewTab('day')}>
            Day view
          </TabPill>
        </TabBar>
        <div className="flex items-center gap-2">
          <label htmlFor="clinician-filter" className="text-sm font-medium text-[#65758b]">
            Clinician
          </label>
          <select
            id="clinician-filter"
            value={selectedDoctorId}
            onChange={(event) => setSelectedDoctorId(event.target.value)}
            className="rounded-lg border border-[#e1e7ef] bg-white px-3 py-2 text-sm text-[#344256]"
          >
            <option value="all">All clinicians</option>
            {clinicians.map((clinician) => (
              <option key={clinician.uid} value={clinician.uid}>
                {memberDisplayLabel(clinician, practice?.ownerId)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {viewTab === 'list' && (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {LIST_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={listFilter === item.key}
                onClick={() => setListFilter(item.key)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                  listFilter === item.key
                    ? 'bg-anixi-green text-white'
                    : 'border border-[#e1e7ef] bg-white text-[#65758b] hover:border-anixi-green/40 hover:text-[#344256]',
                )}
              >
                {item.label}
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                    listFilter === item.key ? 'bg-white/15 text-white' : 'bg-[#f4f7f6] text-[#344256]',
                  )}
                >
                  {filterCounts[item.key]}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm text-[#65758b]">
            {listFilter === 'upcoming'
              ? selectedClinicianName
                ? `Open visits with ${selectedClinicianName}.`
                : 'Open visits across your clinicians.'
              : listFilter === 'today'
                ? selectedClinicianName
                  ? `Today's diary for ${selectedClinicianName}.`
                  : "Today's diary across your clinicians."
                : `${LIST_FILTERS.find((item) => item.key === listFilter)?.label} visits${
                    selectedClinicianName ? ` for ${selectedClinicianName}` : ''
                  }.`}
          </p>

          <div className="mt-4">
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

      {viewTab === 'day' && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const key = toDateKey(day);
              const isSelected = key === selectedDate;
              const isToday = key === todayKey;
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
                      : 'border-[#e1e7ef] bg-white hover:border-anixi-green/40',
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                    {day.toLocaleDateString('en-ZA', { weekday: 'short' })}
                  </p>
                  <p
                    className={clsx(
                      'mt-1 text-lg font-bold',
                      isToday ? 'text-anixi-green' : 'text-[#344256]',
                    )}
                  >
                    {day.getDate()}
                  </p>
                  {count > 0 && (
                    <p className="mt-1 text-[10px] font-medium text-anixi-green">
                      {count} visit{count === 1 ? '' : 's'}
                    </p>
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
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
              />
              {doctorHoursForDay.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
                    Clinic hours
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[#65758b]">
                    {doctorHoursForDay.map((block) => (
                      <li key={block.id}>
                        {selectedDoctorId === 'all' && (
                          <span className="font-medium text-[#344256]">
                            {doctorLabelById.get(block.doctorId) || 'Clinician'}:{' '}
                          </span>
                        )}
                        {block.startTime}, {block.endTime}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Link
                to="/clinic/settings?tab=schedules"
                className="mt-4 inline-block text-xs font-semibold text-anixi-green hover:underline"
              >
                Edit clinician hours
              </Link>
              {clinicians.length === 0 && (
                <p className="mt-4 text-sm text-amber-700">
                  Invite clinicians to manage their calendars from Clinic settings.
                </p>
              )}
            </div>
            <DayAgendaView
              dateLabel={calendarDay.toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              dateKey={toDateKey(calendarDay)}
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
          prefillDate={selectedDate}
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
        <ClinicAppointmentSheet
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onChanged={(message) => {
            setSelectedAppointment(null);
            void reload();
            setToast({ visible: true, message, type: 'success' });
          }}
        />
      )}
    </PageShell>
  );
};

export default ClinicAdminSchedulePage;
