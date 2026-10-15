import type { Appointment } from '../types';
import {
  appointmentInstant,
  sortAppointmentsByStart,
} from './appointmentDateFilters';
import {
  getCalendarRangeInTimeZone,
  instantInCalendarRange,
} from './timezones';

const CLOSED = new Set(['cancelled', 'auto_cancelled', 'completed', 'no_show']);

export function isOpenAppointment(appointment: Appointment): boolean {
  return !CLOSED.has(String(appointment.status).toLowerCase());
}

export type DashboardListItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: 'urgent' | 'soon' | 'routine' | 'neutral';
};

export function formatAppointmentWhen(
  appointment: Appointment,
  timeZone: string,
  includeDate: boolean,
): string {
  const instant = appointmentInstant(appointment);
  const time = appointment.time?.trim();
  if (!includeDate) {
    return time || appointment.status;
  }
  if (!instant) {
    return [time, appointment.status].filter(Boolean).join(' · ');
  }
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(instant);
  return [dateLabel, time].filter(Boolean).join(' · ');
}

export function toDashboardAppointmentItem(
  appointment: Appointment,
  timeZone: string,
  includeDate: boolean,
): DashboardListItem {
  const pending = String(appointment.status).toLowerCase() === 'pending';
  return {
    id: appointment.id,
    title: appointment.patientName || 'Patient',
    subtitle: formatAppointmentWhen(appointment, timeZone, includeDate),
    badge: appointment.status,
    tone: pending ? 'soon' : 'neutral',
  };
}

export function upcomingAppointments(
  appointments: Appointment[],
  now: Date = new Date(),
): Appointment[] {
  return sortAppointmentsByStart(
    appointments.filter((appointment) => {
      if (!isOpenAppointment(appointment)) return false;
      const instant = appointmentInstant(appointment);
      return instant != null && instant.getTime() >= now.getTime();
    }),
  );
}

export function weekAppointments(
  appointments: Appointment[],
  timeZone: string,
  now: Date = new Date(),
): Appointment[] {
  const { startKey } = getCalendarRangeInTimeZone('week', timeZone, now);
  const [y, m, d] = startKey.split('-').map(Number);
  const sunday = new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
  return sortAppointmentsByStart(
    appointments.filter((appointment) => {
      if (!isOpenAppointment(appointment)) return false;
      const instant = appointmentInstant(appointment);
      if (!instant) return false;
      return instantInCalendarRange(instant, startKey, sunday, timeZone);
    }),
  );
}

export function allOpenAppointments(appointments: Appointment[]): Appointment[] {
  return sortAppointmentsByStart(appointments.filter(isOpenAppointment));
}
