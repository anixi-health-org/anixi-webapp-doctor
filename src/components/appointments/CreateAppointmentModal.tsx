import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getPatientsByDoctorId } from '../../services/unifiedPatientDataSource';
import { createAppointment } from '../../services/appointmentService';
import { getAvailableSlots, validateSlot, createScheduledAppointment } from '../../services/schedulingService';
import { createDoctorNotification } from '../../services/doctorNotificationService';
import { Patient, AvailableSlot, ConsultType, PracticeMember } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Toast } from '../ui';
import { modalityFromConsultType } from '../../utils/teleconsult';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import { listPracticePatients } from '../../services/practicePatientService';
import { usesClinicAdminPortal } from '../../lib/doctorAccess';
import { memberDisplayLabel } from '../../services/practiceMemberService';

const CONSULT_TYPES: { value: ConsultType; label: string }[] = [
  { value: 'initial', label: 'Initial Consultation' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'teleconsult', label: 'Virtual / video' },
  { value: 'other', label: 'Other' },
];

const WHATSAPP_COMING_SOON_NOTE =
  'WhatsApp consultations are coming soon.';

const fmt12 = (d: Date) =>
  d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentCreated: (message?: string) => void;
  
  prefillPatientId?: string;
  prefillPatientName?: string;
  prefillPatientEmail?: string;
  prefillIsManual?: boolean;
  consultTypeDefault?: import('../../types').ConsultType;
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
}) => {
  const { user, practiceSession } = useAuth();
  const { permissions } = usePermissions();
  const canManagePatients = Boolean(permissions.managePatients);
  const canViewAllDoctors = Boolean(permissions.viewAllDoctors);
  const canManageAppointments = Boolean(permissions.manageAppointments);
  const canOverrideConflicts = Boolean(permissions.overrideConflicts);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
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

  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedConsultType, setSelectedConsultType] = useState<ConsultType>(consultTypeDefault ?? 'initial');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
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

  const practiceId = practiceSession?.practice?.id ?? null;
  const isClinicAdmin = usesClinicAdminPortal(practiceSession);
  const hasBookableBlocks = !!practiceId;
  const bookingDoctorId = selectedDoctorId || (isClinicAdmin ? '' : user?.id || '');
  const canPickDoctor =
    (isClinicAdmin && clinicians.length >= 1) ||
    Boolean(canViewAllDoctors && clinicians.length > 1);
  const canBook =
    canManageAppointments &&
    (!isClinicAdmin || (clinicians.length > 0 && Boolean(selectedDoctorId)));
  const isFollowUpFlow = consultTypeDefault === 'follow-up';
  const modalTitle = isFollowUpFlow ? 'Book Follow-up' : 'New Appointment';
  const submitLabel = isFollowUpFlow ? 'Book Follow-up' : 'Create Appointment';

  const loadPatients = useCallback(async () => {
    if (!user?.id || !isOpen) return;
    setIsLoading(true);
    try {
      if (practiceId && (isClinicAdmin || canManagePatients)) {
        const pool = await listPracticePatients(practiceId);
        setPatients(pool);
        return;
      }
      const doctorPatients = await getPatientsByDoctorId(bookingDoctorId || user.id);
      setPatients(doctorPatients);
    } catch {
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, practiceId, bookingDoctorId, canManagePatients, isClinicAdmin, isOpen]);

  useEffect(() => {
    if (!isOpen || !practiceId) {
      setClinicians([]);
      setSelectedDoctorId(isClinicAdmin ? '' : user?.id || '');
      return;
    }
    if (!isClinicAdmin && !canViewAllDoctors) {
      setClinicians([]);
      setSelectedDoctorId(user?.id || '');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await listPracticeClinicians(practiceId);
        if (cancelled) return;
        setClinicians(list);
        setSelectedDoctorId((prev) => {
          if (prev && list.some((c) => c.uid === prev)) return prev;
          if (isClinicAdmin) return list[0]?.uid || '';
          return user?.id || list[0]?.uid || '';
        });
      } catch {
        if (!cancelled) setClinicians([]);
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
    if (!selectedDate || !practiceId || !bookingDoctorId) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    getAvailableSlots(practiceId, bookingDoctorId, new Date(selectedDate), selectedConsultType)
      .then((slots) => {
        if (!cancelled) setAvailableSlots(slots);
      })
      .catch(() => {
        if (!cancelled) setAvailableSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedConsultType, practiceId, bookingDoctorId, user?.id]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const handlePatientChange = (patientId: string) => {
    const p = patients.find((pt) => pt.id === patientId);
    if (p) {
      setFormData({
        ...formData,
        patientId,
        patientName: p.displayName || 'Patient',
        patientEmail: p.email || '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedPatientId = bookingMode === 'anixi' ? formData.patientId : 'manual';
    const resolvedPatientName = bookingMode === 'anixi' ? formData.patientName : manualName.trim();
    const resolvedPatientEmail = bookingMode === 'anixi' ? formData.patientEmail : manualEmail.trim();

    if (!user?.id || !bookingDoctorId || !resolvedPatientName || !selectedDate) {
      setError(
        !bookingDoctorId && isClinicAdmin
          ? 'Please select a doctor for this appointment'
          : 'Please fill in all required fields'
      );
      return;
    }
    if (bookingMode === 'anixi' && !formData.patientId) {
      setError('Please select a patient');
      return;
    }
    if (!canManageAppointments) {
      setError('You do not have permission to create appointments.');
      return;
    }

    
    if (!overrideMode && !selectedSlot) {
      setError('Please select an available time slot.');
      return;
    }
    if (overrideMode && !overrideTime) {
      setError('Please specify a time for the manual override.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let appointmentDate: Date;
      let startAt: Date;
      let endAt: Date;
      let overrideApplied = false;
      let conflictMeta: { reason?: string } | undefined;

      if (overrideMode && overrideTime) {
        appointmentDate = new Date(selectedDate);
        const [h, m] = overrideTime.split(':').map(Number);
        startAt = new Date(appointmentDate);
        startAt.setHours(h, m, 0, 0);
        endAt = new Date(startAt.getTime() + 30 * 60_000);
        overrideApplied = true;
        conflictMeta = { reason: 'Manual override by practitioner' };
      } else {
        startAt = selectedSlot!.startAt;
        endAt = selectedSlot!.endAt;
        appointmentDate = startAt;

        
        if (practiceId) {
          const validation = await validateSlot(
            practiceId,
            bookingDoctorId,
            startAt,
            endAt,
            selectedConsultType
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
                  ? 'This slot overlaps a soft block. You do not have override permission.'
                  : validation.reason === 'appointment_conflict'
                  ? 'This slot conflicts with an existing appointment.'
                  : 'This slot is no longer available. Please refresh and choose another.'
              );
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      const timeStr = fmt12(startAt);

      
      const appointmentStatus =
        bookingMode === 'manual' || practiceSession?.bookingPolicy?.confirmationMode === 'auto'
          ? 'confirmed'
          : 'pending';

      const appointmentId = await createAppointment({
        doctorId: bookingDoctorId,
        patientId: resolvedPatientId,
        patientName: resolvedPatientName,
        patientEmail: resolvedPatientEmail,
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
          patientId: resolvedPatientId,
          patientName: resolvedPatientName,
          patientEmail: resolvedPatientEmail,
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
        body: `Appointment created for ${resolvedPatientName} on ${startAt.toLocaleDateString('en-GB')} at ${timeStr}.`,
        appointmentId,
      }).catch((error) => {
        console.warn('[CreateAppointmentModal] createDoctorNotification failed:', error);
      });

      onAppointmentCreated(
        overrideApplied
          ? 'Appointment created with override successfully.'
          : 'Appointment created successfully.'
      );
      onClose();
      
      setFormData({ patientId: '', patientName: '', patientEmail: '', notes: '' });
      setSelectedDate('');
      setSelectedSlot(null);
      setOverrideMode(false);
      setOverrideTime('');
      setManualName('');
      setManualEmail('');
      setBookingMode('anixi');
    } catch (err: any) {
      const msg = err?.message || 'Failed to create appointment';
      setError(msg);
      setToast({ visible: true, message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#e1e7ef] bg-white shadow-xl overscroll-contain">
        <Card className="border-0 shadow-none">
          <CardHeader className="relative border-b border-[#e1e7ef]">
            <CardTitle className="text-xl font-bold text-gray-900">{modalTitle}</CardTitle>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
              aria-label="Close appointment modal"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              
              {isClinicAdmin && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Doctor *</label>
                  {clinicians.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <p>No doctors on the team yet.</p>
                      <Link
                        to="/clinic/team"
                        className="mt-1 inline-block font-semibold text-anixi-green hover:underline"
                      >
                        Invite doctors from Team & doctors →
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {clinicians.map((c) => (
                        <option key={c.uid} value={c.uid}>
                          {memberDisplayLabel(c, practiceSession?.practice?.ownerId)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {!isClinicAdmin && canPickDoctor && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Doctor *</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {clinicians.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {memberDisplayLabel(c, practiceSession?.practice?.ownerId)}
                        {c.uid === user?.id ? ' (you)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Booking Type</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBookingMode('anixi')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      bookingMode === 'anixi'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🔗 Anixi Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode('manual')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      bookingMode === 'manual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ✏️ Manual Booking
                  </button>
                </div>
              </div>

              
              {bookingMode === 'anixi' && (
                <div className="min-h-[72px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  {isLoading ? (
                    <p className="text-sm text-gray-500">Loading patients…</p>
                  ) : patients.length === 0 ? (
                    <div className="rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-3 py-3 text-sm text-[#65758b]">
                      {isClinicAdmin ? (
                        <>
                          No patients in your clinic roster yet.{' '}
                          <Link to="/clinic/patients" className="font-semibold text-anixi-green hover:underline">
                            Import patients →
                          </Link>
                        </>
                      ) : (
                        'No patients found. Add patients first or use manual booking.'
                      )}
                    </div>
                  ) : (
                    <select
                      value={formData.patientId}
                      onChange={(e) => handlePatientChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a patient</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName || p.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              
              {bookingMode === 'manual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={bookingMode === 'manual'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact / Email</label>
                    <input
                      type="text"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="Phone or email (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consult Type *</label>
                <select
                  value={selectedConsultType}
                  onChange={(e) => {
                    setSelectedConsultType(e.target.value as ConsultType);
                    setSelectedSlot(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CONSULT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-amber-700">{WHATSAPP_COMING_SOON_NOTE}</p>
              </div>

              {}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {}
              {selectedDate && hasBookableBlocks && !overrideMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Slots *
                  </label>
                  {loadingSlots ? (
                    <p className="text-sm text-gray-500">Loading slots…</p>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      No available slots within clinic hours on this date.
                      {canOverrideConflicts && (
                        <button
                          type="button"
                          onClick={() => setOverrideMode(true)}
                          className="ml-2 underline text-amber-800 hover:text-amber-900"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                      {availableSlots.map((slot, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setSelectedSlot(slot)}
                          className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                            selectedSlot === slot
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {fmt12(slot.startAt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {}
              {selectedDate && (!hasBookableBlocks || overrideMode) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Time *
                      {overrideMode && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">
                          (Override active)
                        </span>
                      )}
                    </label>
                    {overrideMode && (
                      <button
                        type="button"
                        onClick={() => { setOverrideMode(false); setOverrideTime(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Cancel override
                      </button>
                    )}
                  </div>
                  <input
                    type="time"
                    value={overrideTime}
                    onChange={(e) => setOverrideTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add notes for this appointment…"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f3f6fa]"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-[10px] bg-anixi-green px-4 py-2 text-white transition-colors hover:bg-anixi-green/90 disabled:opacity-50"
                  disabled={isSubmitting || !canBook}
                >
                  {isSubmitting ? 'Saving…' : submitLabel}
                </button>
              </div>
              {!canManageAppointments && (
                <p className="text-xs text-red-500 text-center">
                  You don&apos;t have permission to create appointments.
                </p>
              )}
              {isClinicAdmin && clinicians.length === 0 && (
                <p className="text-xs text-center text-[#65758b]">
                  Invite at least one doctor before booking appointments.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};