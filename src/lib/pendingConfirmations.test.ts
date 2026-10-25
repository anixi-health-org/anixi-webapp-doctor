import type { Appointment } from '../types';
import {
  APPOINTMENTS_FOCUS_PENDING,
  appointmentsPageHref,
  pendingConfirmationAppointments,
} from './pendingConfirmations';

function apt(id: string, status: Appointment['status'], iso: string): Appointment {
  return {
    id,
    doctorId: 'd1',
    patientId: 'p1',
    patientName: 'Patient',
    patientEmail: 'patient@test',
    status,
    date: new Date(iso),
    startAt: new Date(iso),
    scheduledAt: new Date(iso),
    time: '09:00',
    type: 'In-Person',
    consultType: 'follow-up',
    updatedAt: new Date(iso),
    createdAt: new Date(iso),
  };
}

describe('pendingConfirmationAppointments', () => {
  it('returns pending and rescheduled sorted by start', () => {
    const rows = pendingConfirmationAppointments([
      apt('b', 'pending', '2026-10-26T08:00:00.000Z'),
      apt('a', 'confirmed', '2026-10-24T08:00:00.000Z'),
      {
        ...apt('c', 'rescheduled', '2026-10-25T08:00:00.000Z'),
        requiresConfirmation: true,
      },
    ]);
    expect(rows.map((r) => r.id).sort()).toEqual(['b', 'c']);
  });

  it('builds focus href for notifications and nav', () => {
    expect(appointmentsPageHref(true)).toBe(`/appointments?focus=${APPOINTMENTS_FOCUS_PENDING}`);
    expect(appointmentsPageHref(false)).toBe('/appointments');
  });
});
