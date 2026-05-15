import React from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface AppointmentContextState {
  appointmentId?: string;
  appointmentTime?: string;
  appointmentDate?: string;
  consultType?: string;
  status?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  confirmed: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', dot: 'bg-green-500' },
  pending: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  completed: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' },
  cancelled: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', dot: 'bg-red-500' },
  no_show: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500' },
};

export const AppointmentContextBanner: React.FC = () => {
  const location = useLocation();
  const state = (location.state ?? {}) as AppointmentContextState;

  if (!state.appointmentId && !state.appointmentTime) return null;

  const style = STATUS_STYLES[state.status ?? ''] ?? {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  };

  const statusLabel = state.status
    ? state.status.charAt(0).toUpperCase() + state.status.replace('_', ' ').slice(1)
    : null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 mb-4 rounded-xl border text-sm ${style.bg} ${style.text}`}>
      <CalendarIcon className="h-4 w-4 shrink-0" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        <span className="font-semibold">Appointment context</span>
        {state.appointmentDate && (
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {state.appointmentDate}
            {state.appointmentTime && ` · ${state.appointmentTime}`}
          </span>
        )}
        {!state.appointmentDate && state.appointmentTime && (
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {state.appointmentTime}
          </span>
        )}
        {state.consultType && (
          <span className="px-2 py-0.5 rounded-full bg-white/60 font-medium text-xs">
            {state.consultType}
          </span>
        )}
        {statusLabel && (
          <span className="flex items-center gap-1 text-xs font-medium">
            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
};
