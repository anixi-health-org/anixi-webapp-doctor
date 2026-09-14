import type { Practice } from '../types';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';
import { EMPTY_PROFILE_FORM } from '../types/doctorProfile';
import {
  inheritClinicPracticeFields,
  isOnboardingFormComplete,
} from './doctorAccess';

const personalAndProfessional: ProfessionalProfileFormData = {
  ...EMPTY_PROFILE_FORM,
  title: 'Dr',
  fullName: 'Dr Jarjusey',
  gender: 'male',
  idOrPassport: 'A12345678',
  nationality: 'Gambian',
  phoneNumber: '0820000000',
  emailAddress: 'jarjuadama101@gmail.com',
  hpcsaRegistrationNumber: 'MP1234567',
  medicalSpecialty: 'General Practice',
  yearsOfExperience: '8',
};

const clinic: Practice = {
  id: 'clinic-1',
  name: 'AfriMed Hospital',
  tradingName: 'AfriMed',
  timezone: 'Africa/Casablanca',
  ownerId: 'owner-1',
  orgType: 'clinic',
  bhfPracticeNumber: 'BHF-100',
  logoUrl: 'https://cdn.example/afrimed.png',
  locations: [
    {
      id: 'loc-1',
      name: 'Main campus',
      address: '12 Long Street, Cape Town',
      type: 'hospital',
    },
  ],
  consultTypes: [],
  publicListing: { published: true, city: 'Cape Town', province: 'Western Cape' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('inheritClinicPracticeFields', () => {
  it('copies clinic name, timezone, BHF, address, and listing location onto the doctor form', () => {
    const inherited = inheritClinicPracticeFields(clinic);
    expect(inherited.practiceName).toBe('AfriMed');
    expect(inherited.practiceType).toBe('Hospital-based');
    expect(inherited.practiceFacility).toBe('Private Hospital');
    expect(inherited.timezone).toBe('Africa/Casablanca');
    expect(inherited.practiceNumber).toBe('BHF-100');
    expect(inherited.practiceAddress).toBe('12 Long Street, Cape Town');
    expect(inherited.city).toBe('Cape Town');
    expect(inherited.province).toBe('western cape');
    expect(inherited.logoUrl).toBeUndefined();
  });
});

describe('isOnboardingFormComplete', () => {
  it('still requires practice fields for independent doctors', () => {
    expect(isOnboardingFormComplete(personalAndProfessional)).toBe(false);
  });

  it('does not require practice fields when the clinic already owns them', () => {
    expect(
      isOnboardingFormComplete(personalAndProfessional, { inheritPracticeFromClinic: true }),
    ).toBe(true);
  });
});
