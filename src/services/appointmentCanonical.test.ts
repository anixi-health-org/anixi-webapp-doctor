import {
  assertAppointmentStatus,
  canAutoCancelStatus,
  canAutoNoShowStatus,
  effectiveAppointmentStatus,
  formatAppointmentClock,
  formatAppointmentStatusLabel,
  hasConsultBeenStarted,
  isTypeOnlyPatientEdit,
  needsDoctorConfirmation,
  parseAppointmentStatus,
  preferAppointmentStatus,
  resolveAppointmentEndAt,
  resolveScheduledAt,
  shouldAutoMarkNoShow,
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

  it('only auto no-shows confirmed visits', () => {
    expect(canAutoNoShowStatus('confirmed')).toBe(true);
    expect(canAutoNoShowStatus('pending')).toBe(false);
    expect(canAutoNoShowStatus('completed')).toBe(false);
    expect(canAutoNoShowStatus('no_show')).toBe(false);
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

  it('labels no_show as Missed', () => {
    expect(formatAppointmentStatusLabel('no_show')).toBe('Missed');
    expect(formatAppointmentStatusLabel('confirmed')).toBe('Confirmed');
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

  it('uses endAt when present for slot end', () => {
    const endAt = new Date('2026-08-14T10:30:00.000Z');
    expect(
      resolveAppointmentEndAt({
        endAt,
        scheduledAt: new Date('2026-08-14T10:00:00.000Z'),
      })?.toISOString()
    ).toBe(endAt.toISOString());
  });

  it('defaults to a 30-minute slot when duration is missing', () => {
    const start = new Date('2026-08-14T10:00:00.000Z');
    expect(
      resolveAppointmentEndAt({
        scheduledAt: start,
      })?.toISOString()
    ).toBe('2026-08-14T10:30:00.000Z');
  });
});

describe('auto missed (no-show) rules', () => {
  const start = new Date('2026-08-14T10:00:00.000Z');
  const afterEnd = new Date('2026-08-14T10:45:00.000Z');
  const duringSlot = new Date('2026-08-14T10:15:00.000Z');

  it('marks confirmed visits missed after the slot ends', () => {
    expect(
      shouldAutoMarkNoShow(
        {
          status: 'confirmed',
          scheduledAt: start,
          durationMinutes: 30,
        },
        afterEnd
      )
    ).toBe(true);
  });

  it('does not mark during the active slot', () => {
    expect(
      shouldAutoMarkNoShow(
        {
          status: 'confirmed',
          scheduledAt: start,
          durationMinutes: 30,
        },
        duringSlot
      )
    ).toBe(false);
  });

  it('skips visits where a consult already started', () => {
    expect(hasConsultBeenStarted({ teleconsult: { status: 'in_progress' } })).toBe(true);
    expect(
      shouldAutoMarkNoShow(
        {
          status: 'confirmed',
          scheduledAt: start,
          durationMinutes: 30,
          teleconsult: { status: 'in_progress' },
        },
        afterEnd
      )
    ).toBe(false);
  });

  it('treats post-consult actions and ended calls as started', () => {
    expect(hasConsultBeenStarted({ postConsultActions: [{ id: 'note' }] })).toBe(true);
    expect(hasConsultBeenStarted({ teleconsult: { status: 'ended' } })).toBe(true);
    expect(hasConsultBeenStarted({ teleconsult: { roomName: 'room-1', provider: 'livekit' } })).toBe(
      true
    );
  });
});

describe('preferAppointmentStatus', () => {
  it('keeps completed over no_show when copies disagree', () => {
    expect(preferAppointmentStatus('no_show', 'completed')).toBe('completed');
    expect(preferAppointmentStatus('completed', 'no_show')).toBe('completed');
  });
});
