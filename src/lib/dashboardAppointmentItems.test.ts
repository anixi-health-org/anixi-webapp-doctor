import type { Appointment } from '../types';
import { upcomingAppointments, weekAppointments } from './dashboardAppointmentItems';

function apt(id: string, iso: string, status: Appointment['status'] = 'confirmed'): Appointment {
  const date = new Date(iso);
  return {
    id,
    patientId: 'p1',
    patientName: 'Test Patient',
    patientEmail: 'patient@example.com',
    doctorId: 'd1',
    date,
    time: '09:00',
    scheduledAt: date,
    startAt: date,
    status,
    timezone: 'Africa/Johannesburg',
    type: 'Follow-up',
    createdAt: date,
    updatedAt: date,
  };
}

describe('dashboardAppointmentItems', () => {
  const now = new Date('2026-09-20T10:00:00+02:00');

  it('counts later-day visits as upcoming when today is empty', () => {
    const rows = [
      apt('tomorrow', '2026-09-22T09:00:00+02:00'),
      apt('done', '2026-09-20T08:00:00+02:00', 'completed'),
    ];
    expect(upcomingAppointments(rows, now).map((row) => row.id)).toEqual(['tomorrow']);
  });

  it('includes later days this week, not only days already elapsed', () => {
    const wednesday = new Date('2026-09-16T10:00:00+02:00');
    const rows = [
      apt('friday', '2026-09-18T09:00:00+02:00'),
      apt('next-week', '2026-09-28T09:00:00+02:00'),
    ];
    expect(
      weekAppointments(rows, 'Africa/Johannesburg', wednesday).map((row) => row.id),
    ).toEqual(['friday']);
  });
});
