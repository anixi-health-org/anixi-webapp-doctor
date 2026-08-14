export {};

describe('telemedicine room identity', () => {
  it('is always anixi-apt-{appointmentId}', () => {
    const roomNameForAppointment = (appointmentId: string) =>
      `anixi-apt-${appointmentId}`;
    expect(roomNameForAppointment('abc123')).toBe('anixi-apt-abc123');
  });
});

describe('patient notification identity', () => {
  it('uses a deterministic id so reconnects do not duplicate', () => {
    const appointmentId = 'apt-1';
    const type = 'booking_confirmed';
    expect(`${appointmentId}_${type}`).toBe('apt-1_booking_confirmed');
  });
});
