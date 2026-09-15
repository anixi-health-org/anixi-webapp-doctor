import { mapPanelPatient, patientFromPanelAndChart } from './patientManagementService';

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

describe('patientFromPanelAndChart', () => {
  it('merges panel contact with the patient app medical profile', () => {
    const patient = patientFromPanelAndChart(
      '9f7d5a50-39af-4396-a63e-4c33124b1af4',
      {
        patientId: '9f7d5a50-39af-4396-a63e-4c33124b1af4',
        displayName: 'AADIL DODIA',
        email: 'dodia@example.com',
        phoneNumber: '+27396635346',
        status: 'active',
        practiceId: 'practice-1',
      },
      {
        profile: {
          fullName: 'AADIL DODIA',
          cellNumber: '+27396635346',
          email: 'dodia@example.com',
          gender: 'Male',
          bloodGroup: 'O+',
          weight: '82',
          physicalAddress: {
            address: '12 Long Street',
            city: 'Cape Town',
            state: 'Western Cape',
            postalCode: '8001',
            country: 'South Africa',
          },
          allergies: ['Penicillin'],
          previousHealthConditions: ['Hypertension'],
          medicalSchemeName: 'Discovery',
          memberNumber: 'D-100',
        },
      },
      'doctor-1',
    );

    expect(patient).not.toBeNull();
    expect(patient?.phoneNumber).toBe('+27396635346');
    expect(patient?.address).toBe('12 Long Street, Cape Town, Western Cape, 8001, South Africa');
    expect(patient?.bloodGroup).toBe('O+');
    expect(patient?.weight).toBe('82');
    expect(patient?.allergies).toEqual(['Penicillin']);
    expect(patient?.chronicDiseases).toEqual(['Hypertension']);
    expect(patient?.rosterStatus).toBe('active');
    expect(patient?.gender).toBe('male');
    expect(patient?.medicalAid?.provider).toBe('Discovery');
  });

  it('returns null when neither panel nor chart is available', () => {
    expect(patientFromPanelAndChart('missing', undefined, null)).toBeNull();
  });
});
