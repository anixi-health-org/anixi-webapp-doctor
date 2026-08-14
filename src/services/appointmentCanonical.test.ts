import {
  assertAppointmentStatus,
  canAutoCancelStatus,
  effectiveAppointmentStatus,
  formatAppointmentClock,
  isTypeOnlyPatientEdit,
  needsDoctorConfirmation,
  parseAppointmentStatus,
  resolveScheduledAt,
} from './appointmentCanonical';

describe('appointment canonical status', () => {
  it('keeps first-class states instead of folding them into pending', () => {
    expect(parseAppointmentStatus('rescheduled')).toBe('rescheduled');
    expect(parseAppointmentStatus('no_show')).toBe('no_show');
    expect(parseAppointmentStatus('auto_cancelled')).toBe('auto_cancelled');
    expect(parseAppointmentStatus('confirmed')).toBe('confirmed');
  });

  it('does not invent pending for an unknown status', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(parseAppointmentStatus('maybe')).toBeNull();
    expect(parseAppointmentStatus(undefined)).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('refuses to write an unknown status', () => {
    expect(() => assertAppointmentStatus('mystery')).toThrow(/Unknown appointment status/);
  });

  it('never auto-cancels a no-show', () => {
    expect(canAutoCancelStatus('no_show')).toBe(false);
    expect(canAutoCancelStatus('confirmed')).toBe(false);
    expect(canAutoCancelStatus('pending')).toBe(true);
    expect(canAutoCancelStatus('rescheduled')).toBe(true);
  });

  it('treats legacy type-only edits as confirmed, not awaiting confirmation', () => {
    const typeOnly = { status: 'rescheduled' as const };
    expect(isTypeOnlyPatientEdit(typeOnly)).toBe(true);
    expect(effectiveAppointmentStatus(typeOnly)).toBe('confirmed');
    expect(needsDoctorConfirmation(typeOnly)).toBe(false);
  });

  it('keeps true slot moves as rescheduled', () => {
    const slotMove = {
      status: 'rescheduled' as const,
      editScope: 'slot' as const,
      requiresConfirmation: true,
    };
    expect(isTypeOnlyPatientEdit(slotMove)).toBe(false);
    expect(effectiveAppointmentStatus(slotMove)).toBe('rescheduled');
    expect(needsDoctorConfirmation(slotMove)).toBe(true);
  });
});

describe('appointment canonical time', () => {
  it('prefers scheduledAt over a display time string', () => {
    const scheduledAt = new Date('2026-08-13T08:00:00.000Z');
    const instant = resolveScheduledAt({
      scheduledAt,
      time: '10:00 AM',
      date: new Date('2026-08-13T00:00:00.000Z'),
    });
    expect(instant?.toISOString()).toBe(scheduledAt.toISOString());
  });

  it('does not invent 10:00 AM when the instant is missing', () => {
    expect(formatAppointmentClock(null)).toBe('Time unavailable');
    expect(resolveScheduledAt({})).toBeNull();
  });
});
