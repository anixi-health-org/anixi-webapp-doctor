import { patientAccountStatus, patientAccountStatusLabel } from './patientRosterStatus';

describe('patientAccountStatus', () => {
  it('does not invent clinical stable/critical labels', () => {
    expect(patientAccountStatus({ email: 'a@clinic.test' })).toBe('unknown');
    expect(patientAccountStatusLabel(patientAccountStatus({ email: 'a@clinic.test' }))).toBe(
      'Not recorded',
    );
  });

  it('uses the recorded roster status from the API', () => {
    expect(patientAccountStatus({ email: 'a@clinic.test', rosterStatus: 'active' })).toBe('active');
    expect(patientAccountStatus({ email: '', rosterStatus: 'pending' })).toBe('pending');
  });

  it('treats placeholder roster emails as pending activation, not as contact', () => {
    expect(
      patientAccountStatus({ email: 'roster+809cf954@pending.anixi.health' }),
    ).toBe('pending');
    expect(patientAccountStatusLabel('pending')).toBe('Pending activation');
  });
});
