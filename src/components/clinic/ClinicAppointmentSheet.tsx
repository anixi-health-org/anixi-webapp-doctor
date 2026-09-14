import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FileText,
  MapPin,
  Stethoscope,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  formatAppointmentStatusLabel,
  needsDoctorConfirmation,
} from '../../services/appointmentCanonical';
import {
  cancelClinicAppointment,
  completeClinicAppointment,
  confirmClinicAppointment,
  createClinicVisitInvoice,
  markClinicAppointmentMissed,
  rescheduleClinicAppointment,
} from '../../services/clinicAppointmentActions';
import { getBookableBlocks } from '../../services/practiceSettingsService';
import { getAvailableSlots } from '../../services/schedulingService';
import { updateAppointmentRoom } from '../../services/queueService';
import { activeRooms } from '../../services/roomService';
import { InvoiceModal } from '../appointments/InvoiceModal';
import { CreateAppointmentModal } from '../appointments/CreateAppointmentModal';
import { BookingWeekStrip } from '../appointments/booking/BookingWeekStrip';
import { BookingSlotPicker } from '../appointments/booking/BookingSlotPicker';
import {
  filterUpcomingSlots,
  formatSlotTime,
  hoursForDoctorOnWeekday,
  localTodayKey,
  weekdayFromKey,
} from '../appointments/booking/bookingHelpers';
import { asDate, parseDateKey, toDateKey } from '../calendar/calendarDateUtils';
import { formatAppointmentTypeLabel } from '../../utils/teleconsult';
import { isPlaceholderPatientEmail } from '../../utils/patientContact';
import { CONSULT_TYPE_CATALOG } from '../../lib/consultTypeSettings';
import type {
  Appointment,
  AvailableSlot,
  BookableBlock,
  ConsultType,
  Doctor,
  InvoiceLineItem,
} from '../../types';
import clsx from 'clsx';

type Props = {
  appointment: Appointment;
  onClose: () => void;
  onChanged: (message: string) => void;
};

type Panel = 'idle' | 'reschedule' | 'cancel' | 'decline' | 'missed';

const STATUS_PILL: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  rescheduled: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  completed: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  cancelled: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  auto_cancelled: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  no_show: 'bg-orange-50 text-orange-800 ring-1 ring-orange-100',
};

const consultTypeOf = (appointment: Appointment): ConsultType =>
  (appointment.consultType as ConsultType) ||
  (appointment.type === 'Follow-up' ? 'follow-up' : appointment.type === 'Virtual' ? 'teleconsult' : 'initial');

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'P';

const ActionTile: React.FC<{
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
}> = ({ title, description, onClick, disabled, tone = 'default' }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      'group flex min-h-[8.5rem] h-full flex-col rounded-2xl border p-5 text-left shadow-sm transition disabled:opacity-50',
      tone === 'primary' &&
        'border-transparent bg-anixi-green text-white hover:bg-[#365c4f]',
      tone === 'danger' &&
        'border-red-100 bg-white text-[#344256] hover:border-red-200 hover:bg-red-50',
      tone === 'default' &&
        'border-[#e1e7ef] bg-white text-[#344256] hover:border-anixi-green/30 hover:shadow-md',
    )}
  >
    <span className="text-base font-semibold">{title}</span>
    <span
      className={clsx(
        'mt-1.5 flex-1 text-sm leading-relaxed',
        tone === 'primary' ? 'text-white/80' : 'text-[#65758b]',
      )}
    >
      {description}
    </span>
    <ArrowRight
      className={clsx(
        'mt-5 h-4 w-4 transition group-hover:translate-x-0.5',
        tone === 'primary' ? 'text-white/80' : 'text-[#8FA0B6]',
      )}
    />
  </button>
);

const MoreAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, title, description, onClick, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex items-start gap-3 rounded-2xl border border-[#e1e7ef] bg-[#fafcfb] px-4 py-3.5 text-left transition hover:border-anixi-green/30 hover:bg-white disabled:opacity-50"
  >
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#8FA0B6] shadow-sm ring-1 ring-[#e1e7ef]">
      {icon}
    </span>
    <span>
      <span className="block text-sm font-semibold text-[#344256]">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-[#65758b]">{description}</span>
    </span>
  </button>
);

export const ClinicAppointmentSheet: React.FC<Props> = ({ appointment, onClose, onChanged }) => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const practiceId = appointment.practiceId || practice?.id;
  const canManage = can('manageAppointments');
  const actor = user?.role === 'doctor' ? (user as Doctor) : null;

  const startAt = asDate(appointment.startAt) || asDate(appointment.scheduledAt) || asDate(appointment.date);
  const statusLabel = formatAppointmentStatusLabel(appointment.status);
  const typeLabel = formatAppointmentTypeLabel(appointment);
  const consultType = consultTypeOf(appointment);
  const durationMinutes =
    appointment.durationMinutes || CONSULT_TYPE_CATALOG[consultType]?.durationMinutes || 30;
  const timeLabel =
    appointment.time && !appointment.time.includes('T')
      ? appointment.time
      : startAt
        ? startAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
        : 'Time TBC';
  const weekdayLabel = startAt
    ? startAt.toLocaleDateString('en-ZA', { weekday: 'short' }).toUpperCase()
    : '';
  const dayNumber = startAt ? String(startAt.getDate()) : '--';
  const monthLabel = startAt ? startAt.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : '';
  const dateSentence = startAt
    ? startAt.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Date TBC';
  const isTerminal =
    appointment.status === 'cancelled' ||
    appointment.status === 'auto_cancelled' ||
    appointment.status === 'completed' ||
    appointment.status === 'no_show';
  const needsConfirm = needsDoctorConfirmation(appointment);
  const hasStarted = Boolean(startAt && startAt.getTime() <= Date.now());
  const rooms = activeRooms(practice);
  const currentRoom = rooms.find((room) => room.id === appointment.roomId);
  const contactLabel = isPlaceholderPatientEmail(appointment.patientEmail)
    ? 'Pending activation'
    : appointment.patientEmail;

  const [panel, setPanel] = useState<Panel>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [roomId, setRoomId] = useState(appointment.roomId || '');
  const [bookableBlocks, setBookableBlocks] = useState<BookableBlock[]>([]);
  const [selectedDate, setSelectedDate] = useState(startAt ? toDateKey(startAt) : localTodayKey());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [rawSlotCount, setRawSlotCount] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideTime, setOverrideTime] = useState('');

  const doctorBlocks = useMemo(
    () => bookableBlocks.filter((block) => block.doctorId === appointment.doctorId),
    [bookableBlocks, appointment.doctorId],
  );
  const hoursToday = hoursForDoctorOnWeekday(
    doctorBlocks,
    appointment.doctorId,
    weekdayFromKey(selectedDate),
  );

  useEffect(() => {
    if (!practiceId) return;
    void getBookableBlocks(practiceId).then(setBookableBlocks);
  }, [practiceId]);

  useEffect(() => {
    if (panel !== 'reschedule' || !practiceId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    getAvailableSlots(practiceId, appointment.doctorId, parseDateKey(selectedDate), consultType, {
      excludeAppointmentId: appointment.id,
    })
      .then((next) => {
        if (cancelled) return;
        setRawSlotCount(next.length);
        setSlots(filterUpcomingSlots(next));
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setRawSlotCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [panel, practiceId, appointment.doctorId, appointment.id, selectedDate, consultType]);

  const run = async (work: () => Promise<void>, success: string) => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this appointment.');
      setBusy(false);
    }
  };

  const saveRoom = async (nextRoomId: string) => {
    setRoomId(nextRoomId);
    try {
      await updateAppointmentRoom(appointment.id, nextRoomId || null, {
        practiceId,
        actorUid: user?.id,
        actorName: user?.displayName,
        roomName: rooms.find((room) => room.id === nextRoomId)?.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign that room.');
      setRoomId(appointment.roomId || '');
    }
  };

  const saveMove = async () => {
    if (!practiceId) return;
    let start: Date;
    let end: Date;
    if (overrideMode && overrideTime) {
      const [hours, minutes] = overrideTime.split(':').map(Number);
      start = parseDateKey(selectedDate);
      start.setHours(hours || 0, minutes || 0, 0, 0);
      end = new Date(start.getTime() + durationMinutes * 60_000);
    } else if (selectedSlot) {
      start = selectedSlot.startAt;
      end = selectedSlot.endAt;
    } else {
      setError('Select a time, or book outside hours.');
      return;
    }
    await run(
      () =>
        rescheduleClinicAppointment({
          appointment,
          practiceId,
          startAt: start,
          endAt: end,
          timeLabel: formatSlotTime(start),
          consultType,
          canOverride: can('overrideConflicts') || canManage,
        }),
      `Moved to ${start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} at ${formatSlotTime(start)}.`,
    );
  };

  const submitInvoice = async (lineItems: InvoiceLineItem[], notes?: string) => {
    await createClinicVisitInvoice({
      appointment,
      actor,
      practice,
      lineItems,
      notes,
    });
    setInvoiceOpen(false);
    onChanged('Invoice created.');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-[#0E2340]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-8"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        role="presentation"
      >
        <div
          className="flex max-h-[100vh] w-full max-w-6xl flex-col overflow-hidden rounded-none border border-[#e1e7ef] bg-[#f4f7f6] shadow-2xl sm:max-h-[92vh] sm:min-h-[40rem] sm:rounded-[28px]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinic-appointment-title"
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#e1e7ef] bg-white px-6 py-5 sm:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8FA0B6]">
                {practice?.name || 'Clinic diary'}
              </p>
              <h2 id="clinic-appointment-title" className="mt-1 font-heading text-[1.75rem] font-bold tracking-tight text-[#1a4d4d]">
                Visit details
              </h2>
              <p className="mt-1 text-sm text-[#65758b]">
                {dateSentence} at {timeLabel} · {typeLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#e1e7ef] p-2 text-[#65758b] transition hover:bg-[#f8fafc] hover:text-[#344256]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-10 sm:py-8">
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <section className="flex h-full flex-col space-y-4">
                <div className="rounded-3xl border border-[#e1e7ef] bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#eef4f1] font-heading text-lg font-bold text-anixi-green">
                      {initialsOf(appointment.patientName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-heading text-xl font-bold text-[#0E2340]">
                          {appointment.patientName}
                        </h3>
                        <span
                          className={clsx(
                            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                            STATUS_PILL[appointment.status] || 'bg-slate-100 text-slate-700',
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#65758b]">{contactLabel}</p>
                      {appointment.isManual ? (
                        <p className="mt-2 text-sm text-[#65758b]">Walk-in, no Anixi account</p>
                      ) : (
                        <Link
                          to={`/clinic/patients/${appointment.patientId}`}
                          onClick={onClose}
                          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-anixi-green hover:underline"
                        >
                          Open patient account
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex overflow-hidden rounded-2xl bg-[#1a4d4d] text-white">
                    <div className="flex w-[5.5rem] flex-col items-center justify-center bg-white/10 px-3 py-4">
                      <p className="text-[10px] font-semibold tracking-[0.18em] text-white/70">{weekdayLabel}</p>
                      <p className="font-heading text-3xl font-bold leading-none">{dayNumber}</p>
                    </div>
                    <div className="flex-1 px-5 py-4">
                      <p className="text-sm text-white/70">{monthLabel}</p>
                      <p className="mt-1 font-heading text-2xl font-semibold">{timeLabel}</p>
                      <p className="mt-1 text-sm text-white/75">
                        {typeLabel} · {durationMinutes} min
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#e1e7ef] bg-white p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Stethoscope className="mt-0.5 h-4 w-4 text-[#8FA0B6]" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">Doctor</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#344256]">
                          {appointment.doctorName || 'Clinician'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 text-[#8FA0B6]" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">Visit type</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#344256]">
                          {typeLabel} · {durationMinutes} min
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-[#8FA0B6]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">Room</p>
                        {canManage && rooms.length > 0 && !isTerminal ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveRoom('')}
                              className={clsx(
                                'rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition',
                                !roomId
                                  ? 'bg-anixi-green text-white ring-anixi-green'
                                  : 'bg-white text-[#344256] ring-[#e1e7ef] hover:bg-[#f8fafc]',
                              )}
                            >
                              Unassigned
                            </button>
                            {rooms.map((room) => (
                              <button
                                key={room.id}
                                type="button"
                                disabled={busy}
                                onClick={() => void saveRoom(room.id)}
                                className={clsx(
                                  'rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition',
                                  roomId === room.id
                                    ? 'bg-anixi-green text-white ring-anixi-green'
                                    : 'bg-white text-[#344256] ring-[#e1e7ef] hover:bg-[#f8fafc]',
                                )}
                              >
                                {room.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-0.5 text-sm font-semibold text-[#344256]">
                            {currentRoom?.name || 'Unassigned'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CalendarClock className="mt-0.5 h-4 w-4 text-[#8FA0B6]" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">When</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#344256]">{dateSentence}</p>
                      </div>
                    </div>
                  </div>
                  {appointment.notes ? (
                    <p className="mt-4 rounded-2xl bg-[#f4f7f6] px-4 py-3 text-sm leading-relaxed text-[#344256]">
                      {appointment.notes}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="flex h-full flex-col rounded-3xl border border-[#e1e7ef] bg-white p-7 shadow-sm">
                {error ? (
                  <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                {panel === 'reschedule' && canManage ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                        Move visit
                      </p>
                      <h3 className="mt-1 font-heading text-xl font-bold text-[#1a4d4d]">
                        Pick a new time with {appointment.doctorName || 'this doctor'}
                      </h3>
                    </div>
                    <BookingWeekStrip
                      selectedDate={selectedDate}
                      onChange={(key) => {
                        setSelectedDate(key);
                        setOverrideMode(false);
                        setOverrideTime('');
                      }}
                      hasHoursOnDate={(key) =>
                        hoursForDoctorOnWeekday(doctorBlocks, appointment.doctorId, weekdayFromKey(key)).length > 0
                      }
                    />
                    <BookingSlotPicker
                      selectedDate={selectedDate}
                      doctorId={appointment.doctorId}
                      doctorName={appointment.doctorName || 'Doctor'}
                      hoursToday={hoursToday}
                      doctorBlocks={doctorBlocks}
                      slots={slots}
                      rawSlotCount={rawSlotCount}
                      loading={loadingSlots}
                      selectedSlot={selectedSlot}
                      onSelectSlot={setSelectedSlot}
                      onJumpToDate={setSelectedDate}
                      canOverride={canManage}
                      overrideMode={overrideMode}
                      overrideTime={overrideTime}
                      onOverrideTimeChange={setOverrideTime}
                      onStartOverride={() => setOverrideMode(true)}
                      onCancelOverride={() => {
                        setOverrideMode(false);
                        setOverrideTime('');
                      }}
                      showHoursLink
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy || (!selectedSlot && !(overrideMode && overrideTime))}
                        onClick={() => void saveMove()}
                        className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {busy ? 'Saving…' : 'Save new time'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPanel('idle')}
                        className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#65758b]"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : panel === 'cancel' || panel === 'decline' || panel === 'missed' ? (
                  <div className="flex min-h-[280px] flex-col justify-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                      {panel === 'missed' ? 'Missed visit' : panel === 'decline' ? 'Decline booking' : 'Cancel visit'}
                    </p>
                    <h3 className="mt-2 font-heading text-2xl font-bold text-[#1a4d4d]">
                      {panel === 'missed'
                        ? `Mark ${appointment.patientName} as missed?`
                        : panel === 'decline'
                          ? `Decline ${appointment.patientName}'s request?`
                          : `Cancel this visit on ${dateSentence}?`}
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-[#65758b]">
                      {panel === 'missed'
                        ? 'Use this when the patient did not attend. You can still create an invoice afterwards if needed.'
                        : 'The patient will be notified if they have already activated their Anixi account.'}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              panel === 'missed'
                                ? markClinicAppointmentMissed(appointment, practiceId)
                                : cancelClinicAppointment(appointment, practiceId, timeLabel),
                            panel === 'missed'
                              ? 'Marked as missed.'
                              : panel === 'decline'
                                ? 'Booking declined.'
                                : 'Visit cancelled.',
                          )
                        }
                        className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {busy
                          ? 'Saving…'
                          : panel === 'missed'
                            ? 'Mark missed'
                            : panel === 'decline'
                              ? 'Decline booking'
                              : 'Cancel visit'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPanel('idle')}
                        className="rounded-full border border-[#e1e7ef] px-5 py-2.5 text-sm font-semibold text-[#344256]"
                      >
                        Keep visit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                      Manage this visit
                    </p>
                    <h3 className="mt-1 font-heading text-xl font-bold text-[#1a4d4d]">
                      {needsConfirm ? 'This booking is waiting for confirmation' : 'What would you like to do?'}
                    </h3>
                    <p className="mt-2 text-sm text-[#65758b]">
                      {needsConfirm
                        ? 'Confirm to keep it on the diary, or decline if the slot should be freed.'
                        : `${appointment.patientName} is booked with ${appointment.doctorName || 'a clinician'} for a ${typeLabel.toLowerCase()}.`}
                    </p>

                    {!canManage ? (
                      <p className="mt-6 rounded-2xl bg-[#f4f7f6] px-4 py-3 text-sm text-[#65758b]">
                        You can view this appointment but you do not have permission to change it.
                      </p>
                    ) : needsConfirm && !isTerminal ? (
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <ActionTile
                          title="Confirm booking"
                          description="Keep this slot and notify the patient if they have an account."
                          tone="primary"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => confirmClinicAppointment(appointment, practiceId, timeLabel),
                              'Booking confirmed.',
                            )
                          }
                        />
                        <ActionTile
                          title="Decline"
                          description="Free the slot and close this request."
                          tone="danger"
                          disabled={busy}
                          onClick={() => setPanel('decline')}
                        />
                      </div>
                    ) : !isTerminal ? (
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <ActionTile
                          title="Move visit"
                          description={`Choose another open time with ${appointment.doctorName || 'this doctor'}.`}
                          tone="primary"
                          disabled={busy}
                          onClick={() => {
                            setPanel('reschedule');
                            setError(null);
                          }}
                        />
                        <ActionTile
                          title="Cancel visit"
                          description="Remove it from the diary. The patient is notified if they have an account."
                          tone="danger"
                          disabled={busy}
                          onClick={() => setPanel('cancel')}
                        />
                      </div>
                    ) : (
                      <p className="mt-6 rounded-2xl bg-[#f4f7f6] px-4 py-3 text-sm text-[#65758b]">
                        This visit is {statusLabel.toLowerCase()}. You can still invoice or book a follow-up.
                      </p>
                    )}

                    {canManage ? (
                      <div className="mt-7 border-t border-[#eef2f6] pt-6">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                          More
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {!isTerminal && hasStarted ? (
                            <MoreAction
                              icon={<CheckCircle2 className="h-4 w-4" />}
                              title="Mark complete"
                              description="The visit has happened. Close it on the diary."
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => completeClinicAppointment(appointment, practiceId),
                                  'Visit marked complete.',
                                )
                              }
                            />
                          ) : null}
                          {!isTerminal && appointment.status !== 'pending' ? (
                            <MoreAction
                              icon={<UserX className="h-4 w-4" />}
                              title="Mark missed"
                              description="The patient did not attend this appointment."
                              disabled={busy}
                              onClick={() => setPanel('missed')}
                            />
                          ) : null}
                          {appointment.status !== 'cancelled' && appointment.status !== 'auto_cancelled' ? (
                            <MoreAction
                              icon={<FileText className="h-4 w-4" />}
                              title="Create invoice"
                              description="Bill this visit without changing its status."
                              disabled={busy}
                              onClick={() => setInvoiceOpen(true)}
                            />
                          ) : null}
                          <MoreAction
                            icon={<CalendarPlus className="h-4 w-4" />}
                            title="Book follow-up"
                            description="Open a new booking for this patient."
                            disabled={busy}
                            onClick={() => setFollowUpOpen(true)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {invoiceOpen ? (
        <InvoiceModal
          isOpen={invoiceOpen}
          onClose={() => setInvoiceOpen(false)}
          onSubmit={submitInvoice}
          appointmentType={typeLabel}
        />
      ) : null}
      {followUpOpen ? (
        <CreateAppointmentModal
          isOpen={followUpOpen}
          onClose={() => setFollowUpOpen(false)}
          prefillPatientId={appointment.isManual ? undefined : appointment.patientId}
          prefillPatientName={appointment.patientName}
          prefillPatientEmail={isPlaceholderPatientEmail(appointment.patientEmail) ? '' : appointment.patientEmail}
          prefillIsManual={appointment.isManual}
          consultTypeDefault="follow-up"
          onAppointmentCreated={(message) => {
            setFollowUpOpen(false);
            onChanged(message || 'Follow-up booked.');
          }}
        />
      ) : null}
    </>
  );
};

export default ClinicAppointmentSheet;
