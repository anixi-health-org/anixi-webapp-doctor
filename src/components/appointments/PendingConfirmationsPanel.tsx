import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { confirmClinicAppointment } from '../../services/clinicAppointmentActions';
import {
  appointmentInstant,
  appointmentTimeZone,
  DEFAULT_APPOINTMENT_TIMEZONE,
} from '../../lib/appointmentDateFilters';
import { formatAppointmentWhen } from '../../lib/dashboardAppointmentItems';
import { formatAppointmentStatusLabel } from '../../services/appointmentCanonical';

type PendingConfirmationsPanelProps = {
  appointments: Appointment[];
  canConfirm: boolean;
  onConfirmed?: (appointmentId: string) => void;
};

function timeLabelForConfirm(appointment: Appointment): string {
  const instant = appointmentInstant(appointment);
  const tz = appointmentTimeZone(appointment);
  if (appointment.time?.trim()) return appointment.time.trim();
  if (!instant) return 'scheduled time';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(instant);
}

export const PendingConfirmationsPanel: React.FC<PendingConfirmationsPanelProps> = ({
  appointments,
  canConfirm,
  onConfirmed,
}) => {
  const navigate = useNavigate();
  const { practiceSession } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (appointments.length === 0) return null;

  const practiceId = practiceSession?.practice?.id;

  const handleConfirm = async (appointment: Appointment) => {
    if (!canConfirm || busyId) return;
    setError(null);
    setBusyId(appointment.id);
    try {
      await confirmClinicAppointment(appointment, practiceId, timeLabelForConfirm(appointment));
      onConfirmed?.(appointment.id);
    } catch {
      setError('Could not confirm this appointment. Try again or open the visit for details.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      id="pending-confirmations"
      className="mb-6 overflow-hidden rounded-[14px] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white shadow-sm"
      aria-labelledby="pending-confirmations-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-100/80 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2
              id="pending-confirmations-heading"
              className="font-heading text-base font-semibold text-[#344256]"
            >
              Needs your confirmation
            </h2>
            <p className="mt-0.5 text-sm text-[#65758b]">
              {appointments.length === 1
                ? '1 booking request is waiting for you — including visits outside today.'
                : `${appointments.length} booking requests are waiting — including visits outside today.`}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          Action required
        </span>
      </div>

      {error && (
        <p className="border-b border-amber-100 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-5">
          {error}
        </p>
      )}

      <ul className="divide-y divide-amber-100/70">
        {appointments.map((appointment) => {
          const tz = appointment.timezone || DEFAULT_APPOINTMENT_TIMEZONE;
          const when = formatAppointmentWhen(appointment, tz, true);
          const statusLabel = formatAppointmentStatusLabel(appointment.status);
          const confirming = busyId === appointment.id;

          return (
            <li
              key={appointment.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#344256]">{appointment.patientName}</p>
                <p className="mt-0.5 text-sm text-[#65758b]">{when}</p>
                <span className="mt-2 inline-flex rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {statusLabel}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/appointments/${appointment.id}`, { state: { appointment } })
                  }
                  className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] transition hover:border-anixi-green/40 hover:text-anixi-green"
                >
                  Review
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
                {canConfirm && (
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void handleConfirm(appointment)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-anixi-green/90 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {confirming ? 'Confirming…' : 'Confirm'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PendingConfirmationsPanel;
