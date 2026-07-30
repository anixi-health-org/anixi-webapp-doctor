export interface ProfessionalProfileFormData {
  title: string;
  fullName: string;
  gender: string;
  idOrPassport: string;
  nationality: string;
  phoneNumber: string;
  emailAddress: string;
  preferredContactMethod: string;
  websiteOrSocialLink: string;
  hpcsaRegistrationNumber: string;
  medicalSpecialty: string;
  yearsOfExperience: string;
  hpcsaCertificate: string;
  practiceLicenceUrl: string;
  practiceType: string;
  practiceName: string;
  timezone: string;
  practiceNumber: string;
  vatNumber: string;
  practiceFacility: string;
  province: string;
  city: string;
  practiceAddress: string;
  logoUrl: string;
}

export const EMPTY_PROFILE_FORM: ProfessionalProfileFormData = {
  title: '',
  fullName: '',
  gender: '',
  idOrPassport: '',
  nationality: '',
  phoneNumber: '',
  emailAddress: '',
  preferredContactMethod: '',
  websiteOrSocialLink: '',
  hpcsaRegistrationNumber: '',
  medicalSpecialty: '',
  yearsOfExperience: '',
  hpcsaCertificate: '',
  practiceLicenceUrl: '',
  practiceType: '',
  practiceName: '',
  timezone: '',
  practiceNumber: '',
  vatNumber: '',
  practiceFacility: '',
  province: '',
  city: '',
  practiceAddress: '',
  logoUrl: '',
};
