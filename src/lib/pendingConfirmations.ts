import type { Appointment } from '../types';
import { needsDoctorConfirmation } from '../services/appointmentCanonical';
import { sortAppointmentsByStart } from './appointmentDateFilters';

export const APPOINTMENTS_FOCUS_PENDING = 'pending';

export function pendingConfirmationAppointments(appointments: Appointment[]): Appointment[] {
  return sortAppointmentsByStart(appointments.filter((row) => needsDoctorConfirmation(row)));
}

export function appointmentsPageHref(focusPending?: boolean): string {
  return focusPending ? `/appointments?focus=${APPOINTMENTS_FOCUS_PENDING}` : '/appointments';
}
