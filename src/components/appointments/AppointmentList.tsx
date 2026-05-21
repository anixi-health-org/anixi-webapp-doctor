import React from 'react';
import { Appointment } from '../../types';
import { AppointmentCard } from './AppointmentCard';
interface AppointmentListProps {
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  isLoading?: boolean;
}
export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  onSelectAppointment,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4 animate-spin">
            <div className="w-full h-full rounded-full border-4 border-gray-200 border-t-blue-600"></div>
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
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-900 font-semibold text-lg">No Appointments</p>
          <p className="text-gray-600 text-sm mt-1">There are no appointments to display</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      {appointments.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          onClick={() => onSelectAppointment(appointment)}
        />
      ))}
    </div>
  );
};
export default AppointmentList;
