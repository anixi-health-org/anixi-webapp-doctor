import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getPatientsByDoctorId } from '../../services/unifiedPatientDataSource';
import { createAppointment } from '../../services/appointmentService';
import { getAvailableSlots, validateSlot, createScheduledAppointment } from '../../services/schedulingService';
import { Patient, Appointment, AvailableSlot, ConsultType } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Toast } from '../ui';

const CONSULT_TYPES: { value: ConsultType; label: string }[] = [
  { value: 'initial', label: 'Initial Consultation' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'teleconsult', label: 'Teleconsult' },
  { value: 'other', label: 'Other' },
];

const fmt12 = (d: Date) =>
  d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentCreated: (message?: string) => void;
  /** Pre-fill from a follow-up context */
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
  const { can } = usePermissions();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  /** Booking mode: Anixi patient from dropdown vs free-text manual */
  const [bookingMode, setBookingMode] = useState<'anixi' | 'manual'>(prefillIsManual ? 'manual' : 'anixi');
  const [manualName, setManualName] = useState(prefillIsManual ? (prefillPatientName ?? '') : '');
  const [manualEmail, setManualEmail] = useState(prefillIsManual ? (prefillPatientEmail ?? '') : '');

  // Slot-picker state
  
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
  const hasBookableBlocks = !!practiceId;

  const loadPatients = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const doctorPatients = await getPatientsByDoctorId(user.id);
      setPatients(doctorPatients);
    } catch {
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen && user?.id) loadPatients();
  }, [isOpen, user?.id, loadPatients]);

  // Load slots when date or consult type changes
  useEffect(() => {
    if (!selectedDate || !practiceId || !user?.id) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    getAvailableSlots(practiceId, user.id, new Date(selectedDate), selectedConsultType)
      .then(setAvailableSlots)
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedConsultType, practiceId, user?.id]);

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

    // Resolve patient info based on booking mode
    const resolvedPatientId = bookingMode === 'anixi' ? formData.patientId : 'manual';
    const resolvedPatientName = bookingMode === 'anixi' ? formData.patientName : manualName.trim();
    const resolvedPatientEmail = bookingMode === 'anixi' ? formData.patientEmail : manualEmail.trim();

    if (!user?.id || !resolvedPatientName || !selectedDate) {
      setError('Please fill in all required fields');
      return;
    }
    if (bookingMode === 'anixi' && !formData.patientId) {
      setError('Please select a patient');
      return;
    }
    if (!can('manageAppointments')) {
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
            user.id,
            startAt,
            endAt,
            selectedConsultType
          );
          if (!validation.valid) {
            if (validation.reason === 'soft_block_conflict' && can('overrideConflicts')) {
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

      
      await createAppointment({
        doctorId: user.id,
        patientId: resolvedPatientId,
        patientName: resolvedPatientName,
        patientEmail: resolvedPatientEmail,
        type: selectedConsultType === 'teleconsult' ? 'Virtual' : 'In-Person',
        status:
          bookingMode === 'manual' || practiceSession?.bookingPolicy?.confirmationMode === 'auto'
            ? 'confirmed'
            : 'pending',
        date: startAt,
        time: timeStr,
        notes: formData.notes,
        isManual: bookingMode === 'manual',
        // Extended fields
        
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
          practiceId,
          doctorId: user.id,
          patientId: resolvedPatientId,
          patientName: resolvedPatientName,
          patientEmail: formData.patientEmail,
          consultType: selectedConsultType,
          locationId: selectedSlot?.locationId ?? '',
          startAt,
          endAt,
          notes: formData.notes,
          requestedByRole: 'doctor',
          overrideApplied,
          conflictMeta,
        });
      }

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">New Appointment</CardTitle>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Booking Mode Toggle */}
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

              {/* Patient — Anixi mode */}
              {bookingMode === 'anixi' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  {isLoading ? (
                    <p className="text-sm text-gray-500">Loading patients…</p>
                  ) : (
                    <select
                      value={formData.patientId}
                      onChange={(e) => handlePatientChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={bookingMode === 'anixi'}
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

              {/* Patient — Manual mode */}
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

              {/* Consult Type */}
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
                      No available slots on this date.
                      {can('overrideConflicts') && (
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

              {/* Notes */}
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
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  disabled={isSubmitting || !can('manageAppointments')}
                >
                  {isSubmitting ? 'Creating…' : 'Create Appointment'}
                </button>
              </div>
              {!can('manageAppointments') && (
                <p className="text-xs text-red-500 text-center">
                  You don't have permission to create appointments.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};