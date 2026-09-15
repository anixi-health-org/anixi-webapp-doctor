import {
  djangoMeToFormRecord,
  firestoreToFormData,
} from './doctorProfileMapper';

describe('djangoMeToFormRecord', () => {
  it('maps nested Django doctor_profile fields onto the profile form', () => {
    const form = firestoreToFormData(
      djangoMeToFormRecord({
        id: 'doc-1',
        email: 'jarju@clinic.test',
        display_name: 'Jarjusey',
        phone_number: '0784476751',
        doctor_profile: {
          title: 'dr',
          gender: 'male',
          id_or_passport: 'A1234567',
          nationality: 'south african',
          medical_specialty: 'General Practice',
          hpcsa_registration_number: 'MR73698508235',
          years_of_experience: 12,
          city: 'Cape Town',
          province: 'western cape',
        },
      }),
    );

    expect(form.title).toBe('Dr');
    expect(form.gender).toBe('Male');
    expect(form.fullName).toBe('Jarjusey');
    expect(form.yearsOfExperience).toBe('11-15');
    expect(form.medicalSpecialty).toBe('General Practice');
    expect(form.hpcsaRegistrationNumber).toBe('MR73698508235');
    expect(form.city).toBe('Cape Town');
    expect(form.phoneNumber).toBe('0784476751');
    expect(form.emailAddress).toBe('jarju@clinic.test');
  });
});
