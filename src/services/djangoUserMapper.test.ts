import { mapDjangoMeToProfessionalUser } from './djangoUserMapper';

describe('mapDjangoMeToProfessionalUser', () => {
  it('maps a clinician as a doctor', () => {
    const user = mapDjangoMeToProfessionalUser({
      id: 'doc-1',
      email: 'clinician@anixi.test',
      display_name: 'Dr Clinician',
      role: 'doctor',
    });
    expect(user.role).toBe('doctor');
    expect(user.email).toBe('clinician@anixi.test');
  });

  it('does not treat Anixi admin accounts as doctors', () => {
    expect(() =>
      mapDjangoMeToProfessionalUser({
        id: 'admin-1',
        email: 'adama.jarju@anixihealth.com',
        display_name: 'Adama Jarju',
        role: 'admin',
      }),
    ).toThrow(/admin portal/i);
  });
});
