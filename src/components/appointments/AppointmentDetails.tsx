import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, ConsultType } from '../../types';
import { convertTimestamp } from '../../utils/dateFormatter';
import { customColors } from '../../lib/customColors';
import { updateAppointment, syncAppointmentStatus } from '../../services/appointmentService';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/AuthContext';
import { validateSlot } from '../../services/schedulingService';
import { CreateAppointmentModal } from './CreateAppointmentModal';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onClose: () => void;
  onEdit?: (appointment: Appointment) => void;
  onStatusChange?: (appointmentId: string, newStatus: Appointment['status']) => void;
  onReschedule?: (appointmentId: string, newDate: Date, newTime: string) => void;
}

const getStatusColor = (status: Appointment['status']): string => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'completed':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return `bg-[${customColors.backgroundLight}] text-[${customColors.textPrimary}] border-[${customColors.borderLight}]`;
  }
};
const getTypeIcon = (type: Appointment['type']): string => {
  switch (type) {
    case 'In-Person':
      return '🏥';
    case 'Virtual':
      return '📹';
    case 'Phone':
      return '📞';
    case 'Follow-up':
      return '📋';
    default:
      return '📅';
  }
};

const convertTo12Hour = (time24: string): string => {
  if (typeof time24 !== 'string') {
    return '10:00 AM';
  }
  const [hour, minute] = time24.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
};

const convertTo24Hour = (timeStr: string): string => {
  if (typeof timeStr !== 'string') {
    return '10:00';
  }
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    const [time, period] = timeStr.split(' ');
    const [hour, minute] = time.split(':').map(Number);
    const hour24 = period === 'PM' && hour !== 12 ? hour + 12 : period === 'AM' && hour === 12 ? 0 : hour;
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else {
    // Assume it's already 24-hour
    return timeStr;
  }
};
export const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({
  appointment,
  onClose,
  onEdit,
  onStatusChange,
  onReschedule,
}) => {
  const { can } = usePermissions();
  const { user, practiceSession } = useAuth();
  const navigate = useNavigate();
  const canManage = can('manageAppointments');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const safeDate = convertTimestamp(appointment.date) ?? new Date();
  const [rescheduleDate, setRescheduleDate] = useState(safeDate.toISOString().split('T')[0]);
  const [rescheduleTime, setRescheduleTime] = useState(convertTo24Hour(appointment.time));
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appointmentDate = convertTimestamp(appointment.date) || new Date();
  const fullDateFormatted = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const patientName = String(appointment.patientName || 'Unknown');
  const patientEmail = String(appointment.patientEmail || 'N/A');
  const appointmentType = String(appointment.type || 'In-Person');
  const appointmentStatus = String(appointment.status || 'pending');
  const appointmentTime = typeof appointment.time === 'string' ? appointment.time : '10:00 AM';
  const appointmentNotes = String(appointment.notes || '');

  const toConsultType = (): ConsultType => {
    if (appointment.consultType) return appointment.consultType;
    if (appointment.type === 'Virtual') return 'teleconsult';
    if (appointment.type === 'Follow-up') return 'follow-up';
    return 'initial';
  };

  const handleAccept = async () => {
    if (!onStatusChange) return;
    setIsProcessing(true);
    setError(null);
    try {
      await updateAppointment(appointment.doctorId, appointment.id, { status: 'confirmed' });
      // Force sync to ensure mobile app sees the changes
      await syncAppointmentStatus(appointment.id);
      onStatusChange(appointment.id, 'confirmed');
      onClose();
    } catch (err) {
      ;
      setError('Failed to accept appointment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!onStatusChange) return;
    setIsProcessing(true);
    setError(null);
    try {
      await updateAppointment(appointment.doctorId, appointment.id, { status: 'cancelled' });
      // Force sync to ensure mobile app sees the changes
      await syncAppointmentStatus(appointment.id);
      onStatusChange(appointment.id, 'cancelled');
      onClose();
    } catch (err) {
      ;
      setError('Failed to cancel appointment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!onStatusChange) return;
    setIsProcessing(true);
    setError(null);
    try {
      await updateAppointment(appointment.doctorId, appointment.id, { status: 'completed' });
      await syncAppointmentStatus(appointment.id);
      onStatusChange(appointment.id, 'completed');
      onClose();
    } catch (err) {
      setError('Failed to mark as completed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNoShow = async () => {
    if (!onStatusChange) return;
    setIsProcessing(true);
    setError(null);
    try {
      await updateAppointment(appointment.doctorId, appointment.id, { status: 'no_show' });
      await syncAppointmentStatus(appointment.id);
      onStatusChange(appointment.id, 'no_show');
      onClose();
    } catch (err) {
      setError('Failed to mark as no-show');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!onReschedule) return;
    setIsProcessing(true);
    setError(null);
    try {
      const newDate = new Date(rescheduleDate);
      const [hours, minutes] = rescheduleTime.split(':').map(Number);
      const startAt = new Date(newDate);
      startAt.setHours(hours, minutes, 0, 0);
      const endAt = new Date(startAt.getTime() + 30 * 60_000);

      const practiceId = practiceSession?.practice?.id;
      let overrideApplied = false;
      let conflictMeta: Appointment['conflictMeta'] = undefined;

      if (practiceId && user?.id) {
        const validation = await validateSlot(
          practiceId,
          user.id,
          startAt,
          endAt,
          toConsultType(),
          appointment.id
        );

        if (!validation.valid) {
          if (validation.reason === 'soft_block_conflict' && can('overrideConflicts')) {
            overrideApplied = true;
            conflictMeta = {
              softBlockId: validation.softBlock?.id,
              reason: `Soft block override: ${validation.softBlock?.title ?? 'blocked time'}`,
            };
          } else {
            const reasonMessage =
              validation.reason === 'outside_bookable_block'
                ? 'The selected time is outside configured bookable blocks.'
                : validation.reason === 'consult_type_not_allowed'
                ? 'This consult type is not allowed for that time block.'
                : validation.reason === 'soft_block_conflict'
                ? 'This time overlaps a soft block and you do not have override permission.'
                : validation.reason === 'appointment_conflict'
                ? 'This time conflicts with another appointment.'
                : 'This time slot is not available.';
            setError(reasonMessage);
            setIsProcessing(false);
            return;
          }
        }
      }

      await updateAppointment(appointment.doctorId, appointment.id, {
        date: startAt,
        time: convertTo12Hour(rescheduleTime),
        startAt,
        endAt,
        status: 'confirmed',
        overrideApplied,
        conflictMeta,
      });
      // Force sync to ensure mobile app sees the changes
      await syncAppointmentStatus(appointment.id);
      onReschedule(appointment.id, startAt, convertTo12Hour(rescheduleTime));
      setShowRescheduleModal(false);
      onClose();
    } catch (err) {
      ;
      setError('Failed to reschedule appointment');
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white rounded-t-xl sm:rounded-lg shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Appointment Details</h1>
            <p className="text-sm text-gray-600 mt-1">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium border mt-2 ${getStatusColor(
                  appointment.status
                )}`}
              >
                {appointmentStatus}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        {}
        <div className="p-4 sm:p-6 space-y-6">
          {}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              👤 Patient Information
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Name</p>
                <p className="text-gray-900 font-medium text-lg">{patientName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Email</p>
                <p className="text-gray-900">
                  <a
                    href={`mailto:${patientEmail}`}
                    className="text-blue-600 hover:underline"
                  >
                    {patientEmail}
                  </a>
                </p>
              </div>
            </div>
          </div>
          {}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              📅 Appointment Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Date</p>
                <p className="text-gray-900 font-medium">{String(fullDateFormatted)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Time</p>
                <p className="text-gray-900 font-medium">{String(appointmentTime)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Type</p>
                <p className="text-gray-900 font-medium">
                  {getTypeIcon(appointment.type)} {String(appointmentType)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    appointment.status
                  )}`}
                >
                  {String(appointmentStatus)}
                </span>
              </div>
            </div>
          </div>
          {}
          {appointmentNotes && appointmentNotes !== '' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                📝 Notes
              </h2>
              <p className="text-gray-900 leading-relaxed">{String(appointmentNotes)}</p>
            </div>
          )}
        </div>
        {}
        <div className="flex flex-col gap-3 sm:flex-row p-4 sm:p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          {error && (
            <div className="w-full sm:flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 flex-1 sm:flex-row">
            {!canManage && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex-1">
                🔒 You have read-only access to appointments.
              </p>
            )}
            {canManage && appointment.status === 'pending' && (
              <button
                onClick={handleAccept}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : '✅ Accept'}
              </button>
            )}

            {canManage && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <button
                onClick={() => setShowRescheduleModal(true)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                style={{ backgroundColor: customColors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primary;
                }}
              >
                📅 Reschedule
              </button>
            )}

            {canManage && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <button
                onClick={handleCancel}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                style={{ backgroundColor: customColors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primary;
                }}
              >
                ❌ Cancel
              </button>
            )}

            {canManage && appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointment.status !== 'no_show' && (
              <button
                onClick={handleComplete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ✔ Completed
              </button>
            )}

            {canManage && appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointment.status !== 'no_show' && (
              <button
                onClick={handleNoShow}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                🚫 No-Show
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Follow-up shortcut */}
            <button
              onClick={() => setShowFollowUpModal(true)}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔄 Follow-Up
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(appointment)}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ✏️ Edit
              </button>
            )}
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Follow-up modal */}
      {showFollowUpModal && (
        <CreateAppointmentModal
          isOpen={showFollowUpModal}
          onClose={() => setShowFollowUpModal(false)}
          onAppointmentCreated={() => {
            setShowFollowUpModal(false);
          }}
          prefillPatientId={appointment.isManual ? undefined : appointment.patientId}
          prefillPatientName={appointment.patientName}
          prefillPatientEmail={appointment.patientEmail}
          prefillIsManual={appointment.isManual}
          consultTypeDefault="follow-up"
        />
      )}

      {}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Reschedule Appointment</h2>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Time
                </label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleReschedule}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                style={{ backgroundColor: customColors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primary;
                }}
              >
                {isProcessing ? 'Rescheduling...' : '📅 Confirm Reschedule'}
              </button>
              <button
                onClick={() => setShowRescheduleModal(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                style={{ backgroundColor: customColors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primary;
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
