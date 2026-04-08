import React from 'react';
import { Appointment, getAppointmentUniqueKey } from '../../types';
import { AppointmentCard } from './AppointmentCard';

interface AppointmentListProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  onAppointmentClick,
  isLoading = false,
  emptyMessage = 'No appointments found',
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-gray-900 font-semibold text-lg">{emptyMessage}</p>
          <p className="text-gray-600 text-sm mt-1">No appointments to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <AppointmentCard
          key={getAppointmentUniqueKey(appointment.patientId, appointment.id)}
          appointment={appointment}
          onClick={() => onAppointmentClick(appointment)}
        />
      ))}
    </div>
  );
};
