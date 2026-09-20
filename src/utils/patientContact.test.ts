import { isPlaceholderPatientEmail, patientContactLabel } from './patientContact';

describe('patientContactLabel', () => {
  it('hides internal login emails from clinic staff', () => {
    expect(patientContactLabel('a1b2c3d4-e5f6-7890-abcd-ef1234567890@internal.anixi.health')).toBe(
      'Pending activation',
    );
  });

  it('hides roster placeholder emails from clinic staff', () => {
    expect(patientContactLabel('roster+316d4d5e@pending.anixi.health')).toBe('Pending activation');
    expect(isPlaceholderPatientEmail('adama@afrimed.com')).toBe(false);
    expect(patientContactLabel('adama@afrimed.com')).toBe('adama@afrimed.com');
    expect(patientContactLabel('')).toBe('');
    expect(patientContactLabel('N/A')).toBe('Pending activation');
  });
});
