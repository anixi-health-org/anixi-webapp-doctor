import React from 'react';
import { Appointment } from '../../types';
import { formatTimestamp, formatTime } from '../../utils/dateFormatter';
import { usePatientInfo } from '../../hooks/usePatientInfo';

interface AppointmentCardProps {
  appointment: Appointment;
  onClick: () => void;
}

const getStatusColor = (status: Appointment['status']): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-l-green-500';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-l-red-500';
    case 'confirmed':
      return 'bg-blue-100 text-blue-800 border-l-blue-500';
    case 'scheduled':
    default:
      return 'bg-yellow-100 text-yellow-800 border-l-yellow-500';
  }
};

const getStatusBadge = (status: Appointment['status']): string => {
  const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold';
  const colors = getStatusColor(status);
  return `${baseClasses} ${colors.split(' ').slice(0, 2).join(' ')}`;
};


const getAppointmentTitle = (title: string | undefined, patientName: string): string => {
  if (title && title !== 'Untitled' && title.trim()) {
    return title;
  }
  return patientName || 'Appointment';
};

export const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onClick }) => {
  const { patientName, isLoading: patientLoading } = usePatientInfo(appointment.patientId);

  const displayTitle = getAppointmentTitle(appointment.title, patientName);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-l-4 rounded-lg hover:shadow-md transition-all duration-200 bg-white border border-gray-200 ${
        getStatusColor(appointment.status).split(' ').slice(2).join(' ')
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {patientLoading ? (
              <span className="text-gray-400 animate-pulse">Loading...</span>
            ) : (
              displayTitle
            )}
          </h3>

          <p className="text-sm text-gray-600 mt-1">
            {patientLoading ? (
              <span className="text-gray-400">Loading patient...</span>
            ) : (
              <>
                👤 <span className="font-medium">{patientName}</span>
              </>
            )}
          </p>

          <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
            <span>📅 {formatTimestamp(appointment.startTime, 'short')}</span>
            <span>🕐 {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
            <span className="px-2 py-1 bg-gray-100 rounded capitalize">
              {appointment.type || 'consultation'}
            </span>
            {appointment.notes && appointment.notes.trim() && (
              <span className="italic truncate" title={appointment.notes}>
                "{appointment.notes}"
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <span className={getStatusBadge(appointment.status)}>
            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
          </span>
        </div>
      </div>

      {appointment.description && appointment.description.trim() && (
        <p className="text-xs text-gray-500 mt-3 line-clamp-2">
          {appointment.description}
        </p>
      )}
    </button>
  );
};
