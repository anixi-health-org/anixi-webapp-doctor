import type { Appointment } from '../types';
import {
  filterAppointmentsByDateRange,
  sortAppointmentsByStart,
} from './appointmentDateFilters';

function apt(id: string, iso: string, tz = 'Africa/Johannesburg'): Appointment {
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
    status: 'confirmed',
    timezone: tz,
    type: 'Follow-up',
    createdAt: date,
    updatedAt: date,
  };
}

describe('appointmentDateFilters', () => {
  const now = new Date('2026-09-20T10:00:00+02:00');

  it('defaults today range to clinic calendar day', () => {
    const rows = [
      apt('today', '2026-09-20T09:00:00+02:00'),
      apt('yesterday', '2026-09-19T09:00:00+02:00'),
    ];
    const filtered = filterAppointmentsByDateRange(rows, 'today', now);
    expect(filtered.map((row) => row.id)).toEqual(['today']);
  });

  it('filters yesterday separately from today', () => {
    const rows = [
      apt('today', '2026-09-20T09:00:00+02:00'),
      apt('yesterday', '2026-09-19T09:00:00+02:00'),
    ];
    const filtered = filterAppointmentsByDateRange(rows, 'yesterday', now);
    expect(filtered.map((row) => row.id)).toEqual(['yesterday']);
  });

  it('includes seven calendar days in last 7 days range', () => {
    const rows = [
      apt('old', '2026-09-12T09:00:00+02:00'),
      apt('in-range', '2026-09-14T09:00:00+02:00'),
      apt('today', '2026-09-20T09:00:00+02:00'),
    ];
    const filtered = filterAppointmentsByDateRange(rows, '7days', now);
    expect(filtered.map((row) => row.id)).toEqual(['in-range', 'today']);
  });

  it('sorts appointments chronologically', () => {
    const rows = [
      apt('later', '2026-09-20T15:00:00+02:00'),
      apt('earlier', '2026-09-20T08:00:00+02:00'),
    ];
    const sorted = sortAppointmentsByStart(rows);
    expect(sorted.map((row) => row.id)).toEqual(['earlier', 'later']);
  });
});
