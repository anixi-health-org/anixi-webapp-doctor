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
import {
  createScheduledAppointment,
  updateScheduledAppointmentStatus,
  validateSlot,
} from '../../services/schedulingService';
import { getPatientForDoctorView } from '../../services/patientManagementService';
import { createInvoiceRecord, invoiceOptionsFromDoctor } from '../../services/invoiceService';
import { CreateAppointmentModal } from './CreateAppointmentModal';
import { InvoiceModal } from './InvoiceModal';
import { sendPatientNotification } from '../../services/notificationService';
import {
  canDoctorStartVideoCall,
  formatAppointmentTypeLabel,
  isPhoneConsult,
  isWhatsAppConsult,
  phoneDeepLink,
  whatsAppDeepLink,
} from '../../utils/teleconsult';
import { formatAppointmentStatusLabel, needsDoctorConfirmation } from '../../services/appointmentCanonical';
import { useAskAnixi } from '../../context/AskAnixiContext';

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
    case 'rescheduled':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'completed':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'cancelled':
    case 'auto_cancelled':
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
    return 'Time unavailable';
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
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openAskAnixi } = useAskAnixi();
  const appointmentDate = convertTimestamp(appointment.date) || new Date();
  const fullDateFormatted = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const patientName = String(appointment.patientName || 'Unknown');
  const patientEmail = String(appointment.patientEmail || 'N/A');
  const appointmentStatusLabel = formatAppointmentStatusLabel(appointment.status || 'pending');
  const appointmentTime =
    typeof appointment.time === 'string' && appointment.time.trim()
      ? appointment.time
      : 'Time unavailable';
  const appointmentNotes = String(appointment.notes || '');

  const appointmentDateTime =
    appointment.scheduledAt ??
    (() => {
      const base = convertTimestamp(appointment.date);
      if (!base) return new Date(0);
      const time24 = convertTo24Hour(appointmentTime);
      const [h, m] = time24.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return base;
      const dt = new Date(base);
      dt.setHours(h, m, 0, 0);
      return dt;
    })();

  const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (60 * 60 * 1000);
  const isTerminal =
    appointment.status === 'cancelled' ||
    appointment.status === 'auto_cancelled' ||
    appointment.status === 'completed';
  const canRescheduleAppointment = canManage && !isTerminal && appointment.status !== 'no_show';
  const canCancelAppointment = canManage && !isTerminal && appointment.status !== 'pending' && hoursUntilAppointment >= 1;
  const canNoShowAppointment =
    canManage &&
    appointment.status !== 'cancelled' &&
    appointment.status !== 'completed' &&
    appointment.status !== 'no_show' &&
    appointment.status !== 'pending';
  const canGenerateInvoice = canManage;
  const isPendingAppointment =
    needsDoctorConfirmation(appointment);

  useEffect(() => {
    setDocuments(appointment.documents ?? []);
  }, [appointment.id, appointment.documents]);

  useEffect(() => {
    if (!isWhatsAppConsult(appointment) && !isPhoneConsult(appointment)) return;
    if (!appointment.patientId || appointment.patientId === 'unknown') return;
    void getPatientForDoctorView(appointment.doctorId, appointment.patientId, {
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
    })
      .then((patient) => setPatientPhone(patient?.phoneNumber || null))
      .catch(() => setPatientPhone(null));
  }, [appointment]);

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
      const confirmedScheduledAt =
        appointment.startAt ?? appointment.scheduledAt ?? appointmentDateTime;
      await updateAppointment(appointment.doctorId, appointment.id, {
        status: 'confirmed',
        requiresConfirmation: false,
        confirmedScheduledAt,
      });
      
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
      const doctorProfile = user.role === 'doctor' ? (user as import('../../types').Doctor) : null;
      await createInvoiceRecord(
        appointment.doctorId,
        appointment.patientId,
        appointment.id,
        lineItems,
        notes,
        doctorProfile?.currency || 'ZAR',
        invoiceOptionsFromDoctor(doctorProfile, appointment.id, appointment.practiceId)
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
    setIsProcessing(true);
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
          } else if (
            validation.reason === 'outside_bookable_block' &&
            can('manageAppointments')
          ) {
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
            setIsProcessing(false);
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
          consultType: toConsultType(),
          locationId: appointment.locationId ?? '',
          startAt,
          endAt,
          notes: appointment.notes,
          status: 'confirmed',
          requestedByRole: 'doctor',
          overrideApplied,
          conflictMeta,
        });
      } else {
        await syncPracticeAppointmentStatus('confirmed');
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

      onReschedule?.(appointment.id, startAt, timeLabel);
      onStatusChange?.(appointment.id, 'confirmed');
      setShowRescheduleModal(false);
      onClose();
    } catch (err) {
      console.error('Error rescheduling:', err);
      setError(err instanceof Error ? err.message : 'Failed to reschedule appointment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenPreVisit = () => {
    if (appointment.isManual) return;
    openAskAnixi({
      autoSend: true,
      context: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        patientName,
      },
      prompt: `Generate a pre-visit briefing for ${patientName} (patientId: ${appointment.patientId}, appointmentId: ${appointment.id}). Use generate-pre-visit-briefing.`,
    });
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
                {appointmentStatusLabel}
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
                  Manual - no Anixi account
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
                        patientName: appointment.patientName,
                        patientEmail: appointment.patientEmail,
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
          {!appointment.isManual ? (
            <div className="rounded-lg border border-[#dbeafe] bg-[#f8fbff] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[#1a4d4d]">Ayah, pre-visit briefing</h2>
                <button
                  type="button"
                  onClick={handleOpenPreVisit}
                  className="rounded-lg bg-[#1a4d4d] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Open in Ayah
                </button>
              </div>
              <p className="mt-2 text-xs text-[#65758b]">
                Pull medications, conditions, and recent visit context before the consult, powered by your practice partner.
              </p>
            </div>
          ) : null}
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
                  {getTypeIcon(appointment.type)} {formatAppointmentTypeLabel(appointment)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    appointment.status
                  )}`}
                >
                  {appointmentStatusLabel}
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
                {documents.map((item) => {
                  const isAudio = String(item.fileType || item.fileName || '').startsWith('audio') || /\.(webm|mp3|wav|ogg)$/i.test(item.fileName || '');
                  return (
                    <div key={item.id} className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.title || item.fileName}</p>
                          <p className="text-xs text-gray-500 mt-1">{item.fileName} • {new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                        {!isAudio && (
                          <div className="ml-4">
                            <a href={item.downloadURL} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Open</a>
                          </div>
                        )}
                      </div>
                      {isAudio && (
                        <div className="mt-2">
                          <audio controls src={item.downloadURL} className="w-full" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {}
        
        <div className="w-full px-2 py-6 border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white mt-6">
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Manage appointment</h2>
              <p className="text-base text-gray-600 mb-6">Choose an action for this appointment</p>

              {!canManage && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">
                    ℹ️ You have read-only access to appointments.
                  </p>
                </div>
              )}

              {/* Primary Actions */}
              {canManage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={handleAccept}
                    disabled={isProcessing || !isPendingAppointment}
                    className="group relative overflow-hidden rounded-xl border-2 border-green-200 bg-green-50 p-4 text-left transition-all duration-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-2xl font-bold text-green-600">
                        ✓
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-900">Accept appointment</h3>
                        <p className="text-sm text-green-700 mt-0.5">Confirm and schedule</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleCancel}
                    disabled={isProcessing || !isPendingAppointment}
                    className="group relative overflow-hidden rounded-xl border-2 border-red-200 bg-red-50 p-4 text-left transition-all duration-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-2xl font-bold text-red-600">
                        ✕
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-red-900">Decline appointment</h3>
                        <p className="text-sm text-red-700 mt-0.5">Reject request</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Secondary Actions */}
              <div className="space-y-3">
                {(isWhatsAppConsult(appointment) || isPhoneConsult(appointment)) && patientPhone ? (
                  <div className="flex flex-col gap-2">
                    {isWhatsAppConsult(appointment) ? (
                      <a
                        href={whatsAppDeepLink(
                          patientPhone,
                          `Hi ${patientName}, this is your doctor regarding your Anixi appointment.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 px-4 text-center text-sm font-semibold text-emerald-900"
                      >
                        Open WhatsApp
                      </a>
                    ) : null}
                    {isPhoneConsult(appointment) ? (
                      <a
                        href={phoneDeepLink(patientPhone)}
                        className="w-full rounded-xl border-2 border-blue-200 bg-blue-50 py-3 px-4 text-center text-sm font-semibold text-blue-900"
                      >
                        Call patient
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {canDoctorStartVideoCall(appointment) && (
                  <button
                    onClick={handleOpenPostConsult}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-between gap-3 rounded-xl py-3 px-4 bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">🩺</span>
                      Start Consultation
                    </span>
                    <span className="text-lg">→</span>
                  </button>
                )}

                <button
                  onClick={() => setShowRescheduleModal(true)}
                  disabled={!canRescheduleAppointment || isProcessing}
                  className="w-full flex items-center justify-between gap-3 rounded-xl py-3 px-4 border-2 border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    Move / reschedule
                  </span>
                  <span>→</span>
                </button>

                <button
                  onClick={handleCancel}
                  disabled={!canCancelAppointment || isProcessing}
                  className="w-full flex items-center justify-between gap-3 rounded-xl py-3 px-4 border-2 border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">⊘</span>
                    Cancel
                  </span>
                  <span>→</span>
                </button>

                <button
                  onClick={handleNoShow}
                  disabled={!canNoShowAppointment || isProcessing}
                  className="w-full flex items-center justify-between gap-3 rounded-xl py-3 px-4 border-2 border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">⊗</span>
                    Missed appointment
                  </span>
                  <span>→</span>
                </button>

                <button
                  onClick={handleOpenInvoiceModal}
                  disabled={!canGenerateInvoice || isProcessing}
                  className="w-full flex items-center justify-between gap-3 rounded-xl py-3 px-4 border-2 border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">💰</span>
                    Create Invoice
                  </span>
                  <span>→</span>
                </button>
              </div>

              {/* Info Messages */}
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium text-gray-500">
                  ℹ️ Cancellations require at least 1 hour before the appointment.
                </p>
                {canManage && !canCancelAppointment && appointment.status !== 'pending' && !isTerminal && (
                  <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ Cancellation is disabled because less than 1 hour remains.
                  </p>
                )}
              </div>

              {/* Error State */}
              {error && (
                <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-800">
                    ❌ {error}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      
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
