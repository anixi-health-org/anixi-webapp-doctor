import type { Appointment } from '../types';
import {
  calendarDateKeyInTimeZone,
  getCalendarRangeInTimeZone,
  instantInCalendarRange,
  type DashboardDateRangeKey,
} from './timezones';

export const DEFAULT_APPOINTMENT_TIMEZONE = 'Africa/Johannesburg';

export type AppointmentDateRange = DashboardDateRangeKey | 'all';

export const APPOINTMENT_DATE_RANGES: { key: AppointmentDateRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 days' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

export function appointmentInstant(appointment: Appointment): Date | null {
  const raw = appointment.scheduledAt || appointment.startAt || appointment.date;
  if (!raw) return null;
  const instant = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function appointmentTimeZone(appointment: Appointment): string {
  return appointment.timezone || DEFAULT_APPOINTMENT_TIMEZONE;
}

export function filterAppointmentsByDateRange(
  appointments: Appointment[],
  range: AppointmentDateRange,
  now: Date = new Date(),
): Appointment[] {
  if (range === 'all') return appointments;

  const { startKey, endKey } = getCalendarRangeInTimeZone(range, DEFAULT_APPOINTMENT_TIMEZONE, now);
  return appointments.filter((appointment) => {
    const instant = appointmentInstant(appointment);
    if (!instant) return false;
    return instantInCalendarRange(
      instant,
      startKey,
      endKey,
      appointmentTimeZone(appointment),
    );
  });
}

export function sortAppointmentsByStart(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((left, right) => {
    const leftTime = appointmentInstant(left)?.getTime() ?? 0;
    const rightTime = appointmentInstant(right)?.getTime() ?? 0;
    return leftTime - rightTime;
  });
}

export function dateRangeSummaryLabel(range: AppointmentDateRange): string {
  switch (range) {
    case 'today':
      return "Today's appointments";
    case 'yesterday':
      return "Yesterday's appointments";
    case '7days':
      return 'Last 7 days';
    case 'week':
      return 'This week';
    case 'month':
      return 'This month';
    default:
      return 'All appointments';
  }
}

/** @deprecated Use filterAppointmentsByDateRange with range "today". */
export function isAppointmentOnClinicDay(
  appointment: Appointment,
  day: Date = new Date(),
): boolean {
  const instant = appointmentInstant(appointment);
  if (!instant) return false;
  const tz = appointmentTimeZone(appointment);
  return (
    calendarDateKeyInTimeZone(instant, tz) ===
    calendarDateKeyInTimeZone(day, DEFAULT_APPOINTMENT_TIMEZONE)
  );
}
