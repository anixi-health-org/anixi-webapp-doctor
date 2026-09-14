import { mapPanelPatient } from './patientManagementService';

describe('mapPanelPatient', () => {
  it('does not invent a name, contact, timestamps, or clinical status', () => {
    const patient = mapPanelPatient({
      patientId: 'abc-123',
      displayName: '',
      email: 'roster+809cf954@pending.anixi.health',
      status: 'pending',
    });
    expect(patient.displayName).toBe('');
    expect(patient.email).toBe('');
    expect(patient.rosterStatus).toBe('pending');
    expect(patient.createdAt).toBeUndefined();
    expect(patient.updatedAt).toBeUndefined();
  });
});
