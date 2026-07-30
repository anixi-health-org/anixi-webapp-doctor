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
    return <ListRowsSkeleton rows={8} />;
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
    <div className="overflow-hidden rounded-[10px] border border-[#e1e7ef] bg-white">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 border-b border-[#e1e7ef] bg-[#f8fafc] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6] sm:grid sm:gap-4">
        <span>Date & time</span>
        <span>Patient</span>
        <span>Type</span>
        <span>Status</span>
      </div>
      <div className="max-h-[min(62vh,720px)] overflow-y-auto">
        {appointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onClick={() => onSelectAppointment(appointment)}
          />
        ))}
      </div>
      <div className="border-t border-[#eef2f6] bg-[#f8fafc] px-4 py-2 text-xs text-[#65758b]">
        {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
      </div>
    </div>
  );
};

export default AppointmentList;
