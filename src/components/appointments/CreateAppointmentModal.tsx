import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getPatientsByDoctorId } from '../../services/unifiedPatientDataSource';
import { createAppointment } from '../../services/appointmentService';
import { getAvailableSlots, validateSlot, createScheduledAppointment } from '../../services/schedulingService';
import { createDoctorNotification } from '../../services/doctorNotificationService';
import {
  Patient,
  AvailableSlot,
  ConsultType,
  PracticeMember,
  BookableBlock,
} from '../../types';
import { Toast } from '../ui';
import { TabBar, TabPill } from '../ui/TabPill';
import { modalityFromConsultType } from '../../utils/teleconsult';
import { getBookableBlocks, listPracticeClinicians } from '../../services/practiceSettingsService';
import { PracticePatientPicker } from '../clinic/PracticePatientPicker';
import { usesClinicAdminPortal } from '../../lib/doctorAccess';
import { memberDisplayLabel } from '../../services/practiceMemberService';
import { CONSULT_TYPE_CATALOG } from '../../lib/consultTypeSettings';
import { parseDateKey } from '../calendar/calendarDateUtils';
import { BookingWeekStrip } from './booking/BookingWeekStrip';
import { BookingSlotPicker } from './booking/BookingSlotPicker';
import {
  doctorHasAnyHours,
  filterUpcomingSlots,
  firstDoctorWithHours,
  formatBookingDate,
  formatHoursSummary,
  formatSlotTime,
  hoursForDoctorOnWeekday,
  localTodayKey,
  slotDurationMinutes,
  weekdayFromKey,
} from './booking/bookingHelpers';

const CONSULT_TYPES = (Object.keys(CONSULT_TYPE_CATALOG) as ConsultType[]).map((value) => ({
  value,
  label: CONSULT_TYPE_CATALOG[value].name,
  duration: CONSULT_TYPE_CATALOG[value].durationMinutes,
}));

const fieldClass =
  'w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256] transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20';

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentCreated: (message?: string) => void;
  prefillPatientId?: string;
  prefillPatientName?: string;
  prefillPatientEmail?: string;
  prefillIsManual?: boolean;
  consultTypeDefault?: ConsultType;
  prefillDate?: string;
}

export const CreateAppointmentModal: React.FC<CreateAppointmentModalProps> = ({
  isOpen,
  onClose,
  onAppointmentCreated,
  prefillPatientId,
  prefillPatientName,
  prefillPatientEmail,
  prefillIsManual,
  consultTypeDefault,
  prefillDate,
}) => {
  const { user, practiceSession } = useAuth();
  const { permissions } = usePermissions();
  const canManagePatients = Boolean(permissions.managePatients);
  const canViewAllDoctors = Boolean(permissions.viewAllDoctors);
  const canManageAppointments = Boolean(permissions.manageAppointments);
  const canOverrideConflicts = Boolean(permissions.overrideConflicts);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [bookableBlocks, setBookableBlocks] = useState<BookableBlock[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const [bookingMode, setBookingMode] = useState<'anixi' | 'manual'>(prefillIsManual ? 'manual' : 'anixi');
  const [manualName, setManualName] = useState(prefillIsManual ? (prefillPatientName ?? '') : '');
  const [manualEmail, setManualEmail] = useState(prefillIsManual ? (prefillPatientEmail ?? '') : '');

  const [selectedDate, setSelectedDate] = useState(localTodayKey);
  const [selectedConsultType, setSelectedConsultType] = useState<ConsultType>(consultTypeDefault ?? 'initial');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [rawSlotCount, setRawSlotCount] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideTime, setOverrideTime] = useState('');

  const [formData, setFormData] = useState({
    patientId: prefillIsManual ? '' : (prefillPatientId ?? ''),
    patientName: prefillIsManual ? '' : (prefillPatientName ?? ''),
    patientEmail: prefillIsManual ? '' : (prefillPatientEmail ?? ''),
    notes: '',
  });

  const isPatientLocked = Boolean(prefillPatientId) && !prefillIsManual;

  const practiceId = practiceSession?.practice?.id ?? null;
  const isClinicAdmin = usesClinicAdminPortal(practiceSession);
  const useRosterSearch = Boolean(practiceId && (isClinicAdmin || canManagePatients));
  const hasBookableBlocks = !!practiceId;
  const bookingDoctorId = selectedDoctorId || (isClinicAdmin ? '' : user?.id || '');
  const canPickDoctor =
    (isClinicAdmin && clinicians.length >= 1) ||
    Boolean(canViewAllDoctors && clinicians.length > 1);
  const canBook =
    canManageAppointments &&
    (!isClinicAdmin || (clinicians.length > 0 && Boolean(selectedDoctorId)));
  const isFollowUpFlow = consultTypeDefault === 'follow-up';
  const modalTitle = isPatientLocked
    ? 'Book appointment'
    : isFollowUpFlow
      ? 'Book follow-up'
      : 'Book appointment';
  const submitLabel = isFollowUpFlow ? 'Confirm follow-up' : 'Confirm booking';

  const selectedClinician = clinicians.find((member) => member.uid === bookingDoctorId);
  const doctorName = selectedClinician
    ? memberDisplayLabel(selectedClinician, practiceSession?.practice?.ownerId)
    : 'Doctor';
  const hoursToday = useMemo(
    () =>
      bookingDoctorId && selectedDate
        ? hoursForDoctorOnWeekday(bookableBlocks, bookingDoctorId, weekdayFromKey(selectedDate))
        : [],
    [bookableBlocks, bookingDoctorId, selectedDate],
  );
  const doctorBlocks = useMemo(
    () => bookableBlocks.filter((block) => block.doctorId === bookingDoctorId && block.active !== false),
    [bookableBlocks, bookingDoctorId],
  );
  const otherDoctorHint = useMemo(() => {
    if (!selectedDate) return null;
    const weekday = weekdayFromKey(selectedDate);
    const other = clinicians.find(
      (member) =>
        member.uid !== bookingDoctorId &&
        hoursForDoctorOnWeekday(bookableBlocks, member.uid, weekday).length > 0,
    );
    if (!other) return null;
    return {
      id: other.uid,
      name: memberDisplayLabel(other, practiceSession?.practice?.ownerId),
    };
  }, [bookableBlocks, bookingDoctorId, clinicians, practiceSession?.practice?.ownerId, selectedDate]);

  const consultMeta = CONSULT_TYPE_CATALOG[selectedConsultType];
  const resolvedPatientName = bookingMode === 'anixi' ? formData.patientName : manualName.trim();
  const bookingReady = Boolean(
    bookingDoctorId &&
      resolvedPatientName &&
      selectedDate &&
      (overrideMode ? overrideTime : selectedSlot),
  );

  const loadPatients = useCallback(async () => {
    if (!user?.id || !isOpen || isPatientLocked) return;
    if (useRosterSearch) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const doctorPatients = await getPatientsByDoctorId(bookingDoctorId || user.id);
      setPatients(doctorPatients);
    } catch {
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, bookingDoctorId, isOpen, isPatientLocked, useRosterSearch]);

  useEffect(() => {
    if (!isOpen || !practiceId) {
      setClinicians([]);
      setBookableBlocks([]);
      setSelectedDoctorId(isClinicAdmin ? '' : user?.id || '');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const blocks = await getBookableBlocks(practiceId);
        if (cancelled) return;
        setBookableBlocks(blocks);

        if (!isClinicAdmin && !canViewAllDoctors) {
          setClinicians([]);
          setSelectedDoctorId(user?.id || '');
          return;
        }

        const list = await listPracticeClinicians(practiceId);
        if (cancelled) return;
        setClinicians(list);
        setSelectedDoctorId((prev) => {
          if (prev && list.some((member) => member.uid === prev)) return prev;
          const preferred = firstDoctorWithHours(list.map((member) => member.uid), blocks);
          if (isClinicAdmin) return preferred || list[0]?.uid || '';
          return user?.id || preferred || list[0]?.uid || '';
        });
      } catch {
        if (!cancelled) {
          setClinicians([]);
          setBookableBlocks([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, practiceId, user?.id, canViewAllDoctors, isClinicAdmin]);

  useEffect(() => {
    if (isOpen && user?.id) {
      void loadPatients();
    }
  }, [isOpen, user?.id, loadPatients]);

  useEffect(() => {
    if (!isOpen) return;
    setBookingMode(isClinicAdmin || !prefillIsManual ? 'anixi' : 'manual');
    setSelectedConsultType(consultTypeDefault ?? 'initial');
    setSelectedDate(prefillDate && prefillDate >= localTodayKey() ? prefillDate : localTodayKey());
    setError(null);
    if (prefillIsManual && !isClinicAdmin) {
      setManualName(prefillPatientName ?? '');
      setManualEmail(prefillPatientEmail ?? '');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      patientId: prefillPatientId ?? '',
      patientName: prefillPatientName ?? '',
      patientEmail: prefillPatientEmail ?? '',
    }));
  }, [
    isOpen,
    prefillPatientId,
    prefillPatientName,
    prefillPatientEmail,
    prefillIsManual,
    isClinicAdmin,
    consultTypeDefault,
    prefillDate,
  ]);

  useEffect(() => {
    if (!selectedDate || !practiceId || !bookingDoctorId) {
      setAvailableSlots([]);
      setRawSlotCount(0);
      setLoadingSlots(false);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    getAvailableSlots(practiceId, bookingDoctorId, parseDateKey(selectedDate), selectedConsultType)
      .then((slots) => {
        if (cancelled) return;
        setRawSlotCount(slots.length);
        setAvailableSlots(filterUpcomingSlots(slots));
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableSlots([]);
        setRawSlotCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedConsultType, practiceId, bookingDoctorId]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const handlePatientChange = (patientId: string, patient?: Patient) => {
    const match = patient || patients.find((row) => row.id === patientId);
    if (!match) return;
    setFormData((current) => ({
      ...current,
      patientId,
      patientName: match.displayName || 'Patient',
      patientEmail: match.email || '',
    }));
  };

  const handleDateChange = (dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
    setOverrideMode(false);
    setOverrideTime('');
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const patientId = bookingMode === 'anixi' ? formData.patientId : 'manual';
    const patientName = bookingMode === 'anixi' ? formData.patientName : manualName.trim();
    const patientEmail = bookingMode === 'anixi' ? formData.patientEmail : manualEmail.trim();

    if (!user?.id || !bookingDoctorId || !patientName || !selectedDate) {
      setError(
        !bookingDoctorId && isClinicAdmin
          ? 'Select a doctor for this appointment.'
          : 'Complete the required booking details.',
      );
      return;
    }
    if (bookingMode === 'anixi' && !formData.patientId) {
      setError('Select a patient from the clinic roster.');
      return;
    }
    if (!canManageAppointments) {
      setError('You do not have permission to create appointments.');
      return;
    }
    if (!overrideMode && !selectedSlot) {
      setError('Select an available time, or book outside hours if you have permission.');
      return;
    }
    if (overrideMode && !overrideTime) {
      setError('Enter a start time for the override.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let startAt: Date;
      let endAt: Date;
      let overrideApplied = false;
      let conflictMeta: { reason?: string } | undefined;

      if (overrideMode && overrideTime) {
        const [hours, minutes] = overrideTime.split(':').map(Number);
        startAt = parseDateKey(selectedDate);
        startAt.setHours(hours, minutes, 0, 0);
        endAt = new Date(startAt.getTime() + (consultMeta?.durationMinutes || 30) * 60_000);
        overrideApplied = true;
        conflictMeta = { reason: 'Manual override by practitioner' };
      } else {
        startAt = selectedSlot!.startAt;
        endAt = selectedSlot!.endAt;

        if (practiceId) {
          const validation = await validateSlot(
            practiceId,
            bookingDoctorId,
            startAt,
            endAt,
            selectedConsultType,
          );
          if (!validation.valid) {
            if (validation.reason === 'soft_block_conflict' && canOverrideConflicts) {
              overrideApplied = true;
              conflictMeta = {
                reason: `Soft block override: ${validation.softBlock?.title}`,
              };
            } else {
              setError(
                validation.reason === 'soft_block_conflict'
                  ? 'This time overlaps a blocked period. You do not have override permission.'
                  : validation.reason === 'appointment_conflict'
                    ? 'This time conflicts with an existing appointment.'
                    : 'This time is no longer available. Choose another slot.',
              );
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      const timeStr = formatSlotTime(startAt);
      const appointmentStatus =
        bookingMode === 'manual' || practiceSession?.bookingPolicy?.confirmationMode === 'auto'
          ? 'confirmed'
          : 'pending';

      const appointmentId = await createAppointment({
        doctorId: bookingDoctorId,
        patientId,
        patientName,
        patientEmail,
        type: modalityFromConsultType(selectedConsultType),
        status: appointmentStatus,
        date: startAt,
        time: timeStr,
        notes: formData.notes,
        isManual: bookingMode === 'manual',
        practiceId: practiceId ?? undefined,
        consultType: selectedConsultType,
        locationId: selectedSlot?.locationId,
        startAt,
        endAt,
        requestedByRole: 'doctor',
        overrideApplied,
        conflictMeta,
      });

      if (practiceId) {
        await createScheduledAppointment({
          appointmentId,
          practiceId,
          doctorId: bookingDoctorId,
          patientId,
          patientName,
          patientEmail,
          consultType: selectedConsultType,
          locationId: selectedSlot?.locationId ?? '',
          startAt,
          endAt,
          notes: formData.notes,
          status: appointmentStatus,
          requestedByRole: 'doctor',
          overrideApplied,
          conflictMeta,
        });
      }

      await createDoctorNotification(bookingDoctorId, {
        type: appointmentStatus === 'pending' ? 'booking_request' : 'system',
        title: 'Appointment created',
        body: `Appointment created for ${patientName} on ${startAt.toLocaleDateString('en-GB')} at ${timeStr}.`,
        appointmentId,
      }).catch((notifyError) => {
        console.warn('[CreateAppointmentModal] createDoctorNotification failed:', notifyError);
      });

      onAppointmentCreated(
        overrideApplied
          ? 'Appointment booked outside published hours.'
          : 'Appointment booked.',
      );
      onClose();
      setFormData({ patientId: '', patientName: '', patientEmail: '', notes: '' });
      setSelectedDate(localTodayKey());
      setSelectedSlot(null);
      setOverrideMode(false);
      setOverrideTime('');
      setManualName('');
      setManualEmail('');
      setBookingMode('anixi');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create the appointment.';
      setError(msg);
      setToast({ visible: true, message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const summaryTime = overrideMode && overrideTime
    ? overrideTime
    : selectedSlot
      ? formatSlotTime(selectedSlot.startAt)
      : null;
  const summaryDuration = selectedSlot
    ? slotDurationMinutes(selectedSlot)
    : consultMeta?.durationMinutes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0E2340]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[#e1e7ef] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e1e7ef] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
              {practiceSession?.practice?.name || 'Clinic diary'}
            </p>
            <h2 id="booking-modal-title" className="mt-0.5 text-xl font-semibold text-[#0E2340]">
              {modalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e1e7ef] p-2 text-[#65758b] transition hover:bg-[#f8fafc] hover:text-[#344256]"
            aria-label="Close booking"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">Who</h3>

                {isClinicAdmin && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#344256]">Doctor</label>
                    {clinicians.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                        <p>No doctors on the team yet.</p>
                        <Link to="/clinic/team" className="mt-1 inline-block font-semibold text-anixi-green hover:underline">
                          Invite doctors from Team
                        </Link>
                      </div>
                    ) : (
                      <>
                        <select
                          value={selectedDoctorId}
                          onChange={(event) => {
                            setSelectedDoctorId(event.target.value);
                            setSelectedSlot(null);
                            setOverrideMode(false);
                          }}
                          className={fieldClass}
                        >
                          {clinicians.map((member) => (
                            <option key={member.uid} value={member.uid}>
                              {memberDisplayLabel(member, practiceSession?.practice?.ownerId)}
                              {doctorHasAnyHours(bookableBlocks, member.uid) ? '' : ' (no hours set)'}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs text-[#65758b]">
                          {hoursToday.length > 0
                            ? `${formatBookingDate(selectedDate)}: ${formatHoursSummary(hoursToday)}`
                            : `${doctorName} has no published hours on this day.`}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {!isClinicAdmin && canPickDoctor && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#344256]">Doctor</label>
                    <select
                      value={selectedDoctorId}
                      onChange={(event) => setSelectedDoctorId(event.target.value)}
                      className={fieldClass}
                    >
                      {clinicians.map((member) => (
                        <option key={member.uid} value={member.uid}>
                          {memberDisplayLabel(member, practiceSession?.practice?.ownerId)}
                          {member.uid === user?.id ? ' (you)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isPatientLocked && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#344256]">Patient</label>
                    <div className="rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-3 py-2.5">
                      <p className="text-sm font-semibold text-[#0E2340]">
                        {formData.patientName || 'Patient'}
                      </p>
                      {formData.patientEmail ? (
                        <p className="text-xs text-[#65758b]">{formData.patientEmail}</p>
                      ) : null}
                    </div>
                  </div>
                )}

                {!isPatientLocked && !isClinicAdmin && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#344256]">Patient source</label>
                    <TabBar>
                      <TabPill active={bookingMode === 'anixi'} onClick={() => setBookingMode('anixi')} className="flex-1">
                        Clinic roster
                      </TabPill>
                      <TabPill active={bookingMode === 'manual'} onClick={() => setBookingMode('manual')} className="flex-1">
                        Walk-in / manual
                      </TabPill>
                    </TabBar>
                  </div>
                )}

                {!isPatientLocked && bookingMode === 'anixi' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#344256]">Patient</label>
                    {useRosterSearch && practiceId ? (
                      <PracticePatientPicker
                        practiceId={practiceId}
                        value={formData.patientId}
                        required
                        onChange={handlePatientChange}
                      />
                    ) : isLoading ? (
                      <p className="text-sm text-[#65758b]">Loading patients...</p>
                    ) : patients.length === 0 ? (
                      <div className="rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-3 py-3 text-sm text-[#65758b]">
                        {isClinicAdmin ? (
                          <>
                            No patients in your clinic roster yet.{' '}
                            <Link to="/clinic/patients" className="font-semibold text-anixi-green hover:underline">
                              Add patients
                            </Link>
                          </>
                        ) : (
                          'No patients found. Add a patient first, or use a walk-in booking.'
                        )}
                      </div>
                    ) : (
                      <select
                        value={formData.patientId}
                        onChange={(event) => handlePatientChange(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select a patient</option>
                        {patients.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.displayName || patient.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {!isPatientLocked && bookingMode === 'manual' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#344256]">Patient name</label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(event) => setManualName(event.target.value)}
                        placeholder="Full name"
                        className={fieldClass}
                        required={bookingMode === 'manual'}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#344256]">Contact (optional)</label>
                      <input
                        type="text"
                        value={manualEmail}
                        onChange={(event) => setManualEmail(event.target.value)}
                        placeholder="Phone or email"
                        className={fieldClass}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#344256]">Visit type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CONSULT_TYPES.map((type) => {
                      const active = selectedConsultType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            setSelectedConsultType(type.value);
                            setSelectedSlot(null);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-anixi-green bg-anixi-green text-white'
                              : 'border-[#e1e7ef] bg-white text-[#344256] hover:border-anixi-green/40'
                          }`}
                        >
                          {type.label}
                          <span className={`ml-1 font-medium ${active ? 'text-white/80' : 'text-[#8FA0B6]'}`}>
                            {type.duration}m
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#344256]">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={`${fieldClass} resize-none`}
                    rows={3}
                    placeholder="Reason for visit, prep, or front-desk notes"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-[#e1e7ef] bg-[#fafcfb] p-4 sm:p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">When</h3>
                {selectedDate ? (
                  <BookingWeekStrip
                    selectedDate={selectedDate}
                    onChange={handleDateChange}
                    hasHoursOnDate={(key) =>
                      Boolean(bookingDoctorId) &&
                      hoursForDoctorOnWeekday(bookableBlocks, bookingDoctorId, weekdayFromKey(key)).length > 0
                    }
                  />
                ) : null}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#344256]">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={localTodayKey()}
                    onChange={(event) => handleDateChange(event.target.value)}
                    className={fieldClass}
                    required
                  />
                </div>
                {selectedDate && hasBookableBlocks ? (
                  <BookingSlotPicker
                    selectedDate={selectedDate}
                    doctorId={bookingDoctorId}
                    doctorName={doctorName}
                    hoursToday={hoursToday}
                    doctorBlocks={doctorBlocks}
                    slots={availableSlots}
                    rawSlotCount={rawSlotCount}
                    loading={loadingSlots}
                    selectedSlot={selectedSlot}
                    onSelectSlot={setSelectedSlot}
                    onJumpToDate={handleDateChange}
                    canOverride={canOverrideConflicts}
                    overrideMode={overrideMode}
                    overrideTime={overrideTime}
                    onOverrideTimeChange={setOverrideTime}
                    onStartOverride={() => {
                      setOverrideMode(true);
                      setSelectedSlot(null);
                      setOverrideTime((current) => current || '09:00');
                    }}
                    onCancelOverride={() => {
                      setOverrideMode(false);
                      setOverrideTime('');
                    }}
                    showHoursLink={isClinicAdmin}
                    otherDoctorHint={otherDoctorHint}
                    onSwitchDoctor={(id) => {
                      setSelectedDoctorId(id);
                      setOverrideMode(false);
                      setSelectedSlot(null);
                    }}
                  />
                ) : selectedDate && !hasBookableBlocks ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#344256]">Time</label>
                    <input
                      type="time"
                      value={overrideTime}
                      onChange={(event) => {
                        setOverrideMode(true);
                        setOverrideTime(event.target.value);
                      }}
                      className={fieldClass}
                      required
                    />
                  </div>
                ) : null}
              </section>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-col gap-3 border-t border-[#e1e7ef] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="min-w-0 text-sm text-[#65758b]">
              {bookingReady ? (
                <span className="font-medium text-[#344256]">
                  {doctorName}
                  {resolvedPatientName ? ` · ${resolvedPatientName}` : ''}
                  {` · ${formatBookingDate(selectedDate)}`}
                  {summaryTime ? ` · ${summaryTime}` : ''}
                  {summaryDuration ? ` · ${consultMeta.name} (${summaryDuration} min)` : ''}
                  {overrideMode ? ' · outside hours' : ''}
                </span>
              ) : (
                'Select a patient and a time to confirm this booking.'
              )}
            </p>
            <div className="flex gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#e1e7ef] px-5 py-2.5 text-sm font-semibold text-[#344256] hover:bg-[#f8fafc]"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={isSubmitting || !canBook || !bookingReady}
              >
                {isSubmitting ? 'Booking…' : submitLabel}
              </button>
            </div>
          </footer>
          {!canManageAppointments ? (
            <p className="px-6 pb-4 text-center text-xs text-red-600">
              You do not have permission to create appointments.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
};
