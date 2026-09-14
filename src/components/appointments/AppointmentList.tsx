import React, { useEffect, useMemo, useState } from 'react';
import { CalendarX2, ChevronDown, ChevronUp } from 'lucide-react';
import { Appointment } from '../../types';
import { AppointmentCard } from './AppointmentCard';
import { ListRowsSkeleton } from '../ui/Skeleton';

interface AppointmentListProps {
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  isLoading?: boolean;
  /** Optional map of doctorId → display name for clinic-wide views */
  doctorLabels?: Record<string, string>;
  showDoctor?: boolean;
  /**
   * How many appointments to show before "See more".
   * Pass 0 or omit with `paginate={false}` to show all.
   */
  pageSize?: number;
  /** When false, all appointments are listed (scrollable). Default true. */
  paginate?: boolean;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  onSelectAppointment,
  isLoading = false,
  doctorLabels,
  showDoctor = false,
  pageSize = 5,
  paginate = true,
}) => {
  const [visibleCount, setVisibleCount] = useState(pageSize > 0 ? pageSize : appointments.length);

  useEffect(() => {
    setVisibleCount(paginate && pageSize > 0 ? pageSize : appointments.length);
  }, [appointments, pageSize, paginate]);

  const shouldPaginate = paginate && pageSize > 0 && appointments.length > pageSize;

  const visibleAppointments = useMemo(() => {
    if (!shouldPaginate) return appointments;
    return appointments.slice(0, visibleCount);
  }, [appointments, shouldPaginate, visibleCount]);

  const hasMore = shouldPaginate && visibleCount < appointments.length;
  const canCollapse = shouldPaginate && visibleCount > pageSize;

  if (isLoading) {
    return <ListRowsSkeleton rows={Math.min(8, pageSize > 0 ? pageSize : 8)} />;
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
      <div
        className={`hidden gap-3 border-b border-[#e1e7ef] bg-[#f8fafc] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6] sm:grid sm:gap-4 ${
          showDoctor
            ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]'
            : 'grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]'
        }`}
      >
        <span>Date & time</span>
        <span>Patient</span>
        {showDoctor && <span>Doctor</span>}
        <span>Type</span>
        <span>Status</span>
      </div>
      <div className={shouldPaginate ? undefined : 'max-h-[min(62vh,720px)] overflow-y-auto'}>
        {visibleAppointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onClick={() => onSelectAppointment(appointment)}
            doctorLabel={doctorLabels?.[appointment.doctorId] || appointment.doctorName}
            showDoctor={showDoctor}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-[#eef2f6] bg-[#f8fafc] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#65758b]">
          {shouldPaginate ? (
            <>
              Showing {visibleAppointments.length} of {appointments.length} appointment
              {appointments.length === 1 ? '' : 's'}
            </>
          ) : (
            <>
              {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
            </>
          )}
        </p>
        {shouldPaginate && (hasMore || canCollapse) && (
          <div className="flex items-center gap-2">
            {canCollapse && (
              <button
                type="button"
                onClick={() => setVisibleCount(pageSize)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e1e7ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#344256] transition hover:border-[#c5cdd8] hover:bg-gray-50"
              >
                Show less
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((count) => Math.min(count + pageSize, appointments.length))
                }
                className="inline-flex items-center gap-1 rounded-lg bg-anixi-green px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#365c4f]"
              >
                See more
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="font-normal opacity-90">
                  ({appointments.length - visibleCount} more)
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentList;
