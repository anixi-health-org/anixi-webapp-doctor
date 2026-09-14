import {
  buildDoctorLetterheadFromUser,
  buildInvoiceLetterhead,
  buildPracticeLetterhead,
  getMissingClinicLetterheadFields,
} from './invoiceLetterhead';

describe('invoice letterhead branding', () => {
  const doctor = {
    id: 'doc-1',
    displayName: 'Dr Molefe',
    licenseNumber: 'MP0123456',
    practiceNumberBhf: 'DOC-BHF',
    practiceName: 'Molefe Rooms',
    logoUrl: 'https://cdn.example/doctor-logo.png',
    officeAddress: 'Sandton',
  };

  const clinic = {
    orgType: 'clinic' as const,
    name: 'Cape Heart Clinic',
    tradingName: 'Cape Heart',
    logoUrl: 'https://cdn.example/clinic-logo.png',
    bhfPracticeNumber: 'CLINIC-BHF',
    locations: [{ address: 'Sea Point, Cape Town' }],
  };

  it('uses the doctor profile for independent / private practice', () => {
    const letterhead = buildInvoiceLetterhead({
      doctor,
      practice: { orgType: 'solo', name: 'Molefe Rooms' },
    });
    expect(letterhead.brandingSource).toBe('doctor');
    expect(letterhead.practiceName).toBe('Molefe Rooms');
    expect(letterhead.logoUrl).toBe(doctor.logoUrl);
    expect(letterhead.practiceNumberBhf).toBe('DOC-BHF');
  });

  it('uses clinic organisation branding for hospital/clinic invoices', () => {
    const letterhead = buildPracticeLetterhead(clinic, doctor, 'Dr Patel');
    expect(letterhead.brandingSource).toBe('practice');
    expect(letterhead.practiceName).toBe('Cape Heart');
    expect(letterhead.logoUrl).toBe(clinic.logoUrl);
    expect(letterhead.practiceNumberBhf).toBe('CLINIC-BHF');
    expect(letterhead.officeAddress).toBe('Sea Point, Cape Town');
    expect(letterhead.displayName).toBe('Dr Patel');
    expect(letterhead.licenseNumber).toBe('MP0123456');
  });

  it('selects clinic branding when orgType is clinic', () => {
    const letterhead = buildInvoiceLetterhead({ doctor, practice: clinic });
    expect(letterhead.brandingSource).toBe('practice');
    expect(letterhead.logoUrl).toBe(clinic.logoUrl);
  });

  it('falls back to the treating doctor name for independent letterhead', () => {
    expect(buildDoctorLetterheadFromUser(doctor).displayName).toBe('Dr Molefe');
  });

  it('requires clinic logo, name, and address', () => {
    expect(
      getMissingClinicLetterheadFields({
        id: 'p1',
        name: '',
        timezone: 'Africa/Johannesburg',
        ownerId: 'o1',
        orgType: 'clinic',
        locations: [],
        consultTypes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }).map((field) => field.key)
    ).toEqual(['logoUrl', 'practiceName', 'officeAddress']);
  });
});
