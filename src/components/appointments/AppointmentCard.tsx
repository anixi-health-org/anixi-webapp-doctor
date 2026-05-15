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
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            👤 {String(appointment.patientName)}
          </h3>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {String(appointment.patientEmail)}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${getStatusColor(
            appointment.status
          )}`}
        >
          {String(appointment.status)}
        </span>
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>📅</span>
          <span>{String(dateFormatted)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>🕐</span>
          <span>{String(timeDisplay)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>{getTypeIcon(appointment.type)}</span>
          <span>{appointment.type}</span>
        </div>
      </div>
      {appointment.notes && (
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-3 line-clamp-2 italic">
          "{appointment.notes}"
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Created {createdAtFormatted}
        </p>
      </div>
    </div>
  );
};
