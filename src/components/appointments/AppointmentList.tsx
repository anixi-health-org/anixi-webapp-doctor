import React from 'react';
import { CalendarX2 } from 'lucide-react';
import { Appointment } from '../../types';
import { AppointmentCard } from './AppointmentCard';
import { ListRowsSkeleton } from '../ui/Skeleton';

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
    return <ListRowsSkeleton rows={4} />;
  }

  if (appointments.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-14">
        <div className="text-center">
          <CalendarX2 className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="font-heading text-lg font-medium text-gray-900">No Appointments</p>
          <p className="mt-1 font-sans text-sm text-gray-500">There are no appointments to display</p>
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
