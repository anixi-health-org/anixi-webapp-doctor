import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, AppointmentDocument, ConsultType, InvoiceLineItem } from '../../types';
import { convertTimestamp } from '../../utils/dateFormatter';
import { customColors } from '../../lib/customColors';
import {
  addAppointmentDocument,
  updateAppointment,
  syncAppointmentStatus,
} from '../../services/appointmentService';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/AuthContext';
import { updateScheduledAppointmentStatus, validateSlot } from '../../services/schedulingService';
import { createInvoice } from '../../services/invoiceService';
import { CreateAppointmentModal } from './CreateAppointmentModal';
import { InvoiceModal } from './InvoiceModal';
import { sendPatientNotification } from '../../services/notificationService';

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
    case 'no_show':
      return 'bg-orange-100 text-orange-800 border-orange-300';
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
  const [showScanModal, setShowScanModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [scanTitle, setScanTitle] = useState('');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreviewURL, setScanPreviewURL] = useState<string | null>(null);
  const [isSavingScan, setIsSavingScan] = useState(false);
  const [documents, setDocuments] = useState<AppointmentDocument[]>(appointment.documents ?? []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const appointmentDateTime = (() => {
    const base = convertTimestamp(appointment.date) ?? new Date();
    const time24 = convertTo24Hour(appointmentTime);
    const [h, m] = time24.split(':').map(Number);
    const dt = new Date(base);
    dt.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
    return dt;
  })();

  const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (60 * 60 * 1000);
  const isTerminal = appointment.status === 'cancelled' || appointment.status === 'completed';
  const canRescheduleAppointment = canManage && !isTerminal && appointment.status !== 'no_show';
  const canCancelAppointment = canManage && !isTerminal && appointment.status !== 'pending' && hoursUntilAppointment >= 1;
  const canNoShowAppointment =
    canManage &&
    appointment.status !== 'cancelled' &&
    appointment.status !== 'completed' &&
    appointment.status !== 'no_show' &&
    appointment.status !== 'pending';
  const canGenerateInvoice = canManage;
  const isPendingAppointment = appointment.status === 'pending';
  const canStartConsultation = canManage && appointment.status === 'confirmed';

  useEffect(() => {
    setDocuments(appointment.documents ?? []);
  }, [appointment.id, appointment.documents]);

  useEffect(() => {
    return () => {
      if (scanPreviewURL) {
        URL.revokeObjectURL(scanPreviewURL);
      }
    };
  }, [scanPreviewURL]);

  const toConsultType = (): ConsultType => {
    if (appointment.consultType) return appointment.consultType;
    if (appointment.type === 'Virtual') return 'teleconsult';
    if (appointment.type === 'Follow-up') return 'follow-up';
    return 'initial';
  };

  const syncPracticeAppointmentStatus = async (status: Appointment['status']) => {
    const practiceId = appointment.practiceId ?? practiceSession?.practice?.id;
    if (!practiceId) return;

    await updateScheduledAppointmentStatus(practiceId, appointment.id, status, {
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startAt: appointment.startAt ?? appointmentDateTime,
    });
  };

  const handleAccept = async () => {
    if (!onStatusChange) return;
    setIsProcessing(true);
    setError(null);
    try {
      await updateAppointment(appointment.doctorId, appointment.id, { status: 'confirmed' });
      
      await syncAppointmentStatus(appointment.id);
      await syncPracticeAppointmentStatus('confirmed');
      if (!appointment.isManual) {
        sendPatientNotification(appointment.patientId, {
          type: 'booking_confirmed',
          title: 'Appointment Confirmed',
          body: `Your appointment on ${appointmentDateTime.toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })} at ${appointmentTime} has been confirmed.`,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
        }).catch(() => {});
      }
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
      
      await syncAppointmentStatus(appointment.id);
      await syncPracticeAppointmentStatus('cancelled');
      if (!appointment.isManual) {
        sendPatientNotification(appointment.patientId, {
          type: 'booking_cancelled',
          title: 'Appointment Cancelled',
          body: `Your appointment on ${appointmentDateTime.toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })} at ${appointmentTime} has been cancelled.`,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
        }).catch(() => {});
      }
      onStatusChange(appointment.id, 'cancelled');
      onClose();
    } catch (err) {
      ;
      setError('Failed to cancel appointment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateInvoice = async (lineItems: InvoiceLineItem[], notes?: string) => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    try {
      // Create invoice
      await createInvoice(
        appointment.doctorId,
        appointment.patientId,
        appointment.id,
        lineItems,
        notes
      );

      // Mark appointment as completed
      if (!onStatusChange) return;
      setIsProcessing(true);
      setError(null);
      try {
        await updateAppointment(appointment.doctorId, appointment.id, { status: 'completed' });
        await syncAppointmentStatus(appointment.id);
        await syncPracticeAppointmentStatus('completed');
        onStatusChange(appointment.id, 'completed');
        setShowInvoiceModal(false);
        onClose();
      } catch (err) {
        setError('Failed to mark appointment as completed');
      } finally {
        setIsProcessing(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create invoice';
      setError(msg);
    }
  };

  const handleNoShow = async () => {
    if (!onStatusChange) return;
    setIsProcessing(true);
    setError(null);
    try {
      await updateAppointment(appointment.doctorId, appointment.id, { status: 'no_show' });
      await syncAppointmentStatus(appointment.id);
      await syncPracticeAppointmentStatus('no_show');
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
      
      await syncAppointmentStatus(appointment.id);
      await syncPracticeAppointmentStatus('confirmed');
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

  const resetScanState = () => {
    setScanTitle('');
    setScanFile(null);
    if (scanPreviewURL) {
      URL.revokeObjectURL(scanPreviewURL);
    }
    setScanPreviewURL(null);
  };

  const handleScanFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (scanPreviewURL) {
      URL.revokeObjectURL(scanPreviewURL);
    }

    setScanFile(file);
    setScanPreviewURL(URL.createObjectURL(file));
    setError(null);
  };

  const handleSaveScan = async () => {
    if (!scanFile) return;
    if (!user?.id) {
      setError('You must be signed in to upload a scanned document.');
      return;
    }

    try {
      setIsSavingScan(true);
      setError(null);
      const saved = await addAppointmentDocument(
        appointment.doctorId,
        appointment.id,
        scanFile,
        user.id,
        scanTitle
      );
      setDocuments((prev) => [saved, ...prev]);
      setShowScanModal(false);
      resetScanState();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save scanned document';
      setError(message);
    } finally {
      setIsSavingScan(false);
    }
  };

  const handleOpenInvoiceModal = () => {
    if (!canGenerateInvoice) return;
    setShowInvoiceModal(true);
  };

  const handleOpenPostConsult = () => {
    navigate(`/appointments/${appointment.id}/post-consult`, {
      state: { appointment },
    });
    onClose();
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                👤 Patient Information
              </h2>
              {appointment.isManual ? (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                  Manual — no Anixi account
                </span>
              ) : (
                <button
                  onClick={() => {
                    navigate(`/patient-profile/${appointment.patientId}`, {
                      state: {
                        appointmentId: appointment.id,
                        appointmentTime,
                        appointmentDate: fullDateFormatted,
                        consultType: appointment.consultType ?? toConsultType(),
                        status: appointment.status,
                      },
                    });
                    onClose();
                  }}
                  className="text-sm font-medium text-[#425950] hover:underline"
                >
                  View profile →
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Name</p>
                <p className="text-gray-900 font-medium text-lg">{patientName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Email</p>
                {patientEmail && patientEmail !== 'N/A' ? (
                  <p className="text-gray-900">
                    <a href={`mailto:${patientEmail}`} className="text-blue-600 hover:underline">
                      {patientEmail}
                    </a>
                  </p>
                ) : (
                  <p className="text-gray-700 italic">Not provided</p>
                )}
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

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">📄 Documents</h2>
              {canManage && (
                <button
                  onClick={() => setShowScanModal(true)}
                  disabled={isProcessing || isSavingScan}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Scan document
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <p className="text-sm text-gray-500">No scanned documents saved yet.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {documents.map((item) => (
                  <a
                    key={item.id}
                    href={item.downloadURL}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.title || item.fileName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.fileName} • {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        {}
        {/* Modal-style action sheet for appointment management (moved below content; scrollable) */}
        <div className="w-full flex flex-col items-center justify-center px-2 py-4 border-t border-gray-200 bg-gray-50 mt-4">
          <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-5 flex flex-col items-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-1">Manage appointment</h2>
            <p className="text-base text-gray-600 mb-5">Choose an action for this appointment.</p>

            {!canManage && (
              <p className="w-full mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You have read-only access to appointments.
              </p>
            )}

            {canManage && (
              <button
                onClick={handleAccept}
                disabled={isProcessing || !isPendingAppointment}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 mb-3 text-lg font-semibold bg-[#3F544D] text-white shadow-sm hover:bg-[#2d3c36] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xl">✔️</span> Accept appointment
              </button>
            )}
            {canManage && (
              <button
                onClick={handleCancel}
                disabled={isProcessing || !isPendingAppointment}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 mb-3 text-lg font-semibold bg-red-500 text-white shadow-sm hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xl">✖️</span> Decline appointment
              </button>
            )}

            <div className="w-full flex flex-col gap-2 mt-2">
              {canStartConsultation && (
                <button
                  onClick={handleOpenPostConsult}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 bg-green-600 text-white font-medium text-base hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-lg">🩺</span> Start consultation
                </button>
              )}
              <button
                onClick={handleOpenPostConsult}
                disabled={isProcessing || isPendingAppointment}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 border border-gray-300 bg-white text-[#3F544D] font-medium text-base hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg">🩺</span> Post-consult workflow
              </button>
              <button
                onClick={() => setShowRescheduleModal(true)}
                disabled={!canRescheduleAppointment || isProcessing}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 border border-gray-300 bg-white text-[#3F544D] font-medium text-base hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg">📅</span> Move / reschedule
              </button>
              <button
                onClick={handleCancel}
                disabled={!canCancelAppointment || isProcessing}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 border border-gray-300 bg-white text-[#3F544D] font-medium text-base hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg">✖️</span> Cancel
              </button>
              <button
                onClick={handleNoShow}
                disabled={!canNoShowAppointment || isProcessing}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 border border-gray-300 bg-white text-[#3F544D] font-medium text-base hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg">👤✖️</span> No-show
              </button>
              <button
                onClick={handleOpenInvoiceModal}
                disabled={!canGenerateInvoice || isProcessing}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 border border-gray-300 bg-white text-[#3F544D] font-medium text-base hover:bg-gray-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-lg">🧾</span> Complete & Create Invoice
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-5">Cancellations require at least 1 hour before the visit.</p>
            {canManage && !canCancelAppointment && appointment.status !== 'pending' && !isTerminal && (
              <p className="text-xs text-amber-700 mt-1">Cancellation is disabled because less than 1 hour remains.</p>
            )}
            {error && (
              <p className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
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

      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">Scan document</h2>
              <button
                onClick={() => {
                  setShowScanModal(false);
                  resetScanState();
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="border border-gray-200 rounded-2xl p-5">
                <h3 className="text-3xl sm:text-2xl font-semibold text-gray-800">Scan document</h3>
                <p className="text-gray-600 mt-2 text-base">Uses the camera and saves to the patient record.</p>
              </div>

              <div>
                <label className="block text-2xl sm:text-lg font-medium text-gray-800 mb-2">Title (optional)</label>
                <input
                  type="text"
                  value={scanTitle}
                  onChange={(e) => setScanTitle(e.target.value)}
                  placeholder="e.g. Referral"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg sm:text-base focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-2xl sm:text-lg font-medium text-gray-800 mb-2">Camera *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleScanFilePicked}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-gray-300 rounded-xl py-4 text-gray-700 text-2xl sm:text-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Open camera
                </button>
              </div>

              {scanPreviewURL && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <img src={scanPreviewURL} alt="Document preview" className="w-full max-h-56 object-cover" />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleSaveScan}
                disabled={!scanFile || isSavingScan}
                className="w-full py-4 rounded-xl text-2xl sm:text-xl font-semibold text-white disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: customColors.primary }}
              >
                {isSavingScan ? 'Saving to record...' : 'Save to record'}
              </button>
            </div>
          </div>
        </div>
      )}

      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
        }}
        onSubmit={handleCreateInvoice}
        appointmentType={appointment.consultType || appointment.type}
      />
    </div>
  );
};
