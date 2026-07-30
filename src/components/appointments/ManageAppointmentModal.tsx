import React, { useState } from 'react';
import { Appointment, ConsultType } from '../../types';
import { updateAppointment, syncAppointmentStatus } from '../../services/appointmentService';
import {
  createScheduledAppointment,
  updateScheduledAppointmentStatus,
  validateSlot,
} from '../../services/schedulingService';
import { sendPatientNotification } from '../../services/notificationService';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useNavigate } from 'react-router-dom';

interface Props {
  appointment: Appointment;
  onClose: () => void;
  onUpdated?: (updated: Partial<Appointment>) => void;
}

type ActionType = 'accept' | 'decline' | 'move' | 'cancel' | 'no_show' | 'invoice';

interface Action {
  id: ActionType;
  label: string;
  icon: string;
  description: string;
  color: 'success' | 'danger' | 'warning' | 'info' | 'secondary';
  handler: () => Promise<void>;
}

const convertTo12Hour = (time24: string): string => {
  const [hour, minute] = time24.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

const convertTo24Hour = (timeStr: string): string => {
  if (!timeStr) return '10:00';
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    const [time, period] = timeStr.split(' ');
    const [hour, minute] = time.split(':').map(Number);
    const hour24 =
      period === 'PM' && hour !== 12 ? hour + 12 : period === 'AM' && hour === 12 ? 0 : hour;
    return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  return timeStr.slice(0, 5);
};

const toConsultType = (appointment: Appointment): ConsultType => {
  if (appointment.consultType) return appointment.consultType;
  if (appointment.type === 'Virtual') return 'teleconsult';
  if (appointment.type === 'Follow-up') return 'follow-up';
  return 'initial';
};

export const ManageAppointmentModal: React.FC<Props> = ({ appointment, onClose, onUpdated }) => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(
    () => (appointment.startAt ?? appointment.date).toISOString().split('T')[0]
  );
  const [rescheduleTime, setRescheduleTime] = useState(() => convertTo24Hour(appointment.time));
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const getActionStyles = (color: string) => {
    const styles = {
      success: 'bg-green-50 border-green-200 hover:bg-green-100 text-green-900',
      danger: 'bg-red-50 border-red-200 hover:bg-red-100 text-red-900',
      warning: 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-900',
      info: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-900',
      secondary: 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-900',
    };
    return styles[color as keyof typeof styles] || styles.secondary;
  };

  const getIconStyles = (color: string) => {
    const styles = {
      success: 'bg-green-100 text-green-600',
      danger: 'bg-red-100 text-red-600',
      warning: 'bg-orange-100 text-orange-600',
      info: 'bg-blue-100 text-blue-600',
      secondary: 'bg-gray-100 text-gray-600',
    };
    return styles[color as keyof typeof styles] || styles.secondary;
  };

  const syncPracticeStatus = async (status: Appointment['status']) => {
    const practiceId = appointment.practiceId ?? practiceSession?.practice?.id;
    if (!practiceId) return;
    await updateScheduledAppointmentStatus(practiceId, appointment.id, status, {
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startAt: appointment.startAt ?? appointment.date,
    });
  };

  const handleRescheduleConfirm = async () => {
    if (!user?.id) return;
    setLoadingAction('move');
    setError(null);
    try {
      const newDate = new Date(`${rescheduleDate}T00:00:00`);
      const [hours, minutes] = rescheduleTime.split(':').map(Number);
      const startAt = new Date(newDate);
      startAt.setHours(hours || 0, minutes || 0, 0, 0);
      const endAt = new Date(startAt.getTime() + 30 * 60_000);
      const timeLabel = convertTo12Hour(rescheduleTime);
      const practiceId = appointment.practiceId ?? practiceSession?.practice?.id;
      let overrideApplied = false;
      let conflictMeta: Appointment['conflictMeta'];

      if (practiceId) {
        const validation = await validateSlot(
          practiceId,
          user.id,
          startAt,
          endAt,
          toConsultType(appointment),
          appointment.id
        );

        if (!validation.valid) {
          if (validation.reason === 'soft_block_conflict' && can('overrideConflicts')) {
            overrideApplied = true;
            conflictMeta = {
              softBlockId: validation.softBlock?.id,
              reason: `Soft block override: ${validation.softBlock?.title ?? 'blocked time'}`,
            };
          } else if (
            validation.reason === 'outside_bookable_block' &&
            can('manageAppointments')
          ) {
            // Doctor-initiated reschedule outside clinic hours — allow with override note.
            overrideApplied = true;
            conflictMeta = { reason: 'Rescheduled outside clinic hours by practitioner' };
          } else {
            const reasonMessage =
              validation.reason === 'outside_bookable_block'
                ? 'The selected time is outside clinic hours.'
                : validation.reason === 'consult_type_not_allowed'
                  ? 'This consult type is not allowed for that clinic session.'
                  : validation.reason === 'soft_block_conflict'
                    ? 'This time overlaps blocked time and you do not have override permission.'
                    : validation.reason === 'appointment_conflict'
                      ? 'This time conflicts with another appointment.'
                      : 'This time slot is not available.';
            setError(reasonMessage);
            setLoadingAction(null);
            return;
          }
        }
      }

      await updateAppointment(appointment.doctorId, appointment.id, {
        date: startAt,
        time: timeLabel,
        startAt,
        endAt,
        status: 'confirmed',
        overrideApplied,
        conflictMeta,
      });
      await syncAppointmentStatus(appointment.id);

      if (practiceId) {
        await createScheduledAppointment({
          appointmentId: appointment.id,
          practiceId,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          patientEmail: appointment.patientEmail,
          consultType: toConsultType(appointment),
          locationId: appointment.locationId ?? '',
          startAt,
          endAt,
          notes: appointment.notes,
          status: 'confirmed',
          requestedByRole: 'doctor',
          overrideApplied,
          conflictMeta,
        });
      }

      if (!appointment.isManual) {
        sendPatientNotification(appointment.patientId, {
          type: 'booking_rescheduled',
          title: 'Appointment Rescheduled',
          body: `Your appointment has been moved to ${startAt.toLocaleDateString('en-ZA', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })} at ${timeLabel}.`,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
        }).catch(() => {});
      }

      onUpdated?.({
        date: startAt,
        time: timeLabel,
        startAt,
        endAt,
        status: 'confirmed',
        overrideApplied,
        conflictMeta,
      });
      onClose();
    } catch (err) {
      console.error('Error rescheduling:', err);
      setError(err instanceof Error ? err.message : 'Failed to reschedule appointment');
    } finally {
      setLoadingAction(null);
    }
  };

  const actions: Action[] = [
    {
      id: 'accept',
      label: 'Accept appointment',
      icon: '✓',
      description: 'Confirm the appointment',
      color: 'success',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'confirmed' });
        await syncAppointmentStatus(appointment.id);
        await syncPracticeStatus('confirmed');
        onUpdated?.({ status: 'confirmed' });
      },
    },
    {
      id: 'decline',
      label: 'Decline appointment',
      icon: '✕',
      description: 'Reject the appointment',
      color: 'danger',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'cancelled' });
        await syncAppointmentStatus(appointment.id);
        await syncPracticeStatus('cancelled');
        onUpdated?.({ status: 'cancelled' });
      },
    },
    {
      id: 'move',
      label: 'Move / reschedule',
      icon: '📅',
      description: 'Change date or time',
      color: 'info',
      handler: async () => {
        setShowReschedule(true);
      },
    },
    {
      id: 'cancel',
      label: 'Cancel',
      icon: '⊘',
      description: 'Cancel the appointment',
      color: 'warning',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'cancelled' });
        await syncAppointmentStatus(appointment.id);
        await syncPracticeStatus('cancelled');
        onUpdated?.({ status: 'cancelled' });
      },
    },
    {
      id: 'no_show',
      label: 'No-show',
      icon: '⊗',
      description: 'Mark as no-show',
      color: 'danger',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'no_show' });
        await syncAppointmentStatus(appointment.id);
        await syncPracticeStatus('no_show');
        onUpdated?.({ status: 'no_show' });
      },
    },
    {
      id: 'invoice',
      label: 'Invoice',
      icon: '💰',
      description: 'Create invoice',
      color: 'secondary',
      handler: async () => {
        onClose();
        navigate(`/invoices/new/${appointment.id}`);
      },
    },
  ];

  const runAction = async (id: string) => {
    const a = actions.find((x) => x.id === id);
    if (!a) return;
    try {
      setLoadingAction(id);
      setError(null);
      await a.handler();
      // Keep modal open when entering reschedule form
      if (id !== 'move') {
        onClose();
      }
    } catch (err) {
      console.error('Error running action:', err);
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoadingAction(null);
    }
  };

  if (showReschedule) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div className="border-b border-gray-200 px-6 py-5">
            <h3 className="text-xl font-bold text-gray-900">Reschedule appointment</h3>
            <p className="mt-1 text-sm text-gray-600">
              {appointment.patientName} · pick a new date and time
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">New date</label>
              <input
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-anixi-green/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">New time</label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-anixi-green/30"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-2xl">
            <button
              type="button"
              onClick={() => {
                setShowReschedule(false);
                setError(null);
              }}
              disabled={!!loadingAction}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleRescheduleConfirm()}
              disabled={!!loadingAction || !rescheduleDate || !rescheduleTime}
              className="flex-1 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365c4f] disabled:opacity-50"
            >
              {loadingAction === 'move' ? 'Saving…' : 'Confirm reschedule'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="mx-auto w-full rounded-2xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 md:w-[580px] md:slide-in-from-bottom-0">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Manage appointment</h3>
              <p className="mt-1.5 text-sm text-gray-600">Choose an action for this appointment</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 transition-colors hover:text-gray-500"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {actions.map((act) => (
              <button
                key={act.id}
                onClick={() => void runAction(act.id)}
                disabled={!!loadingAction}
                className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-200 ${getActionStyles(
                  act.color
                )} ${
                  loadingAction && loadingAction !== act.id ? 'cursor-not-allowed opacity-50' : ''
                } disabled:cursor-not-allowed`}
              >
                <div className="relative z-10 flex items-start gap-3">
                  <div
                    className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg font-semibold ${getIconStyles(
                      act.color
                    )}`}
                  >
                    {act.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold leading-tight">{act.label}</h4>
                      {loadingAction === act.id && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-tight opacity-75">{act.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-b-2xl border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageAppointmentModal;
