import React from 'react';
import { Appointment } from '../../types';
import { convertTimestamp } from '../../utils/dateFormatter';
import { customColors } from '../../lib/customColors';

interface AppointmentCardProps {
  appointment: Appointment;
  onClick: () => void;
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
export const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onClick }) => {
  const appointmentDate = convertTimestamp(appointment.date) || new Date();
  const dateFormatted = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeDisplay = typeof appointment.time === 'string' ? appointment.time : '10:00 AM';
  const createdAtDate = convertTimestamp(appointment.createdAt) || new Date();
  const createdAtFormatted = createdAtDate.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  return (
    <div
      onClick={onClick}
      className={`border rounded-3xl p-5 cursor-pointer transition-all duration-200 bg-white ${appointment.status === 'cancelled' ? 'opacity-80' : ''} shadow-sm hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-white/80 border border-white shadow-sm flex items-center justify-center text-xl">
            {getTypeIcon(appointment.type)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">👤 {String(appointment.patientName)}</h3>
            <p className="text-xs text-gray-500 mt-1 truncate">{String(appointment.patientEmail)}</p>
            <p className="text-[26px] leading-none font-bold text-[#0E2340] mt-2">{String(dateFormatted)}</p>
            <p className="text-sm text-gray-700 mt-1">{String(timeDisplay)}</p>
            <p className="text-xs text-gray-500 mt-2">Created {createdAtFormatted}</p>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${getStatusColor(appointment.status)}`}>{String(appointment.status)}</span>
          <div className="text-sm text-gray-700 mt-4">{appointment.type}</div>
        </div>
      </div>
      {appointment.notes && (
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-4 line-clamp-2 italic">"{appointment.notes}"</div>
      )}
    </div>
  );
};
