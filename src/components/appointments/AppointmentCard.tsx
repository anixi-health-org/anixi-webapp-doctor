import React from 'react';
import { Appointment } from '../../types';
import { convertTimestamp } from '../../utils/dateFormatter';
import { formatAppointmentTypeLabel, isWhatsAppComingSoon } from '../../utils/teleconsult';
import { formatAppointmentStatusLabel } from '../../services/appointmentCanonical';

interface AppointmentCardProps {
  appointment: Appointment;
  onClick: () => void;
  doctorLabel?: string;
  showDoctor?: boolean;
}

const getStatusColor = (status: Appointment['status']): string => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'pending':
    case 'rescheduled':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'completed':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled':
    case 'auto_cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'no_show':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const statusLabel = (status: Appointment['status']): string => {
  return formatAppointmentStatusLabel(status);
};

const getTypeIcon = (type: Appointment['type']): string => {
  switch (type) {
    case 'In-Person':
      return '🏥';
    case 'Virtual':
      return '📹';
    case 'Phone':
      return '💬';
    case 'Follow-up':
      return '📋';
    default:
      return '📅';
  }
};

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onClick,
  doctorLabel,
  showDoctor = false,
}) => {
  const appointmentDate =
    appointment.scheduledAt ||
    convertTimestamp(appointment.date) ||
    new Date();
  const timeZone = appointment.timezone || 'Africa/Johannesburg';
  const dateShort = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const timeDisplay = typeof appointment.time === 'string' ? appointment.time : '-';
  const typeLabel = formatAppointmentTypeLabel(appointment);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full items-center gap-3 border-b border-[#eef2f6] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#f4f7f5] sm:gap-4 sm:px-4 ${
        showDoctor
          ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]'
          : 'grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]'
      } ${appointment.status === 'cancelled' ? 'opacity-70' : ''}`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#0E2340]">{dateShort}</p>
        <p className="mt-0.5 text-xs font-medium text-[#65758b]">{timeDisplay}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#344256]">{appointment.patientName}</p>
        <p className="mt-0.5 truncate text-xs text-[#94a3b8]">
          {appointment.patientEmail || 'No email'}
        </p>
      </div>

      {showDoctor && (
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium text-[#344256]">
            {doctorLabel || 'Doctor'}
          </p>
        </div>
      )}

      <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
        <span className="text-sm leading-none" aria-hidden>
          {getTypeIcon(appointment.type)}
        </span>
        <span
          className={`truncate text-xs font-medium ${
            isWhatsAppComingSoon(appointment) ? 'text-amber-700' : 'text-[#65758b]'
          }`}
        >
          {typeLabel}
        </span>
      </div>

      <span
        className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatusColor(
          appointment.status
        )}`}
      >
        {statusLabel(appointment.status)}
      </span>
    </button>
  );
};
