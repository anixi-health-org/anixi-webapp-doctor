import {
  memberUsesDoctorHonorific,
  practiceMemberGreetingLabel,
  practiceMemberHeaderLabel,
  practiceMemberSubtitle,
} from './practiceMemberDisplay';

describe('practiceMemberDisplay', () => {
  it('shows practice role labels instead of Physician', () => {
    expect(practiceMemberSubtitle(['clinical_associate'])).toBe('Clinical Associate');
    expect(practiceMemberSubtitle(['receptionist', 'content_creator'])).toBe(
      'Receptionist, Content Creator',
    );
  });

  it('uses Dr honorific only for doctor and locum roles', () => {
    expect(memberUsesDoctorHonorific(['clinical_associate'])).toBe(false);
    expect(memberUsesDoctorHonorific(['doctor'])).toBe(true);
    expect(practiceMemberHeaderLabel('Amina Fall', ['clinical_associate'])).toBe('Amina');
    expect(practiceMemberHeaderLabel('Amina Fall', ['doctor'])).toBe('Dr. Amina');
    expect(practiceMemberGreetingLabel('Amina Fall', ['nurse'])).toBe('Amina');
    expect(practiceMemberGreetingLabel('Amina Fall', ['doctor'])).toBe('Dr. Amina');
  });
});
