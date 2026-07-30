import type { ProfessionalProfileFormData } from '../types/doctorProfile';

type FirestoreDoctor = Record<string, unknown>;

const YEARS_RANGE_TO_NUMBER: Record<string, number> = {
  '0-2': 1,
  '3-5': 4,
  '6-10': 8,
  '11-15': 13,
  '16-20': 18,
  '21-25': 23,
  '26+': 26,
};

const YEARS_NUMBER_TO_RANGE: [number, string][] = [
  [2, '0-2'],
  [5, '3-5'],
  [10, '6-10'],
  [15, '11-15'],
  [20, '16-20'],
  [25, '21-25'],
  [Infinity, '26+'],
];

function yearsNumberToRange(years: number): string {
  for (const [max, range] of YEARS_NUMBER_TO_RANGE) {
    if (years <= max) return range;
  }
  return '26+';
}

function titleToForm(value: string | undefined): string {
  if (!value) return '';
  const map: Record<string, string> = {
    dr: 'Dr',
    prof: 'Prof',
    mr: 'Mr',
    mrs: 'Mrs',
    ms: 'Ms',
  };
  return map[value.toLowerCase()] ?? value;
}

function titleToFirestore(value: string): string {
  const map: Record<string, string> = {
    Dr: 'dr',
    Prof: 'prof',
    Mr: 'mr',
    Mrs: 'mrs',
    Ms: 'ms',
  };
  return map[value] ?? value.toLowerCase();
}

function genderToForm(value: string | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function nationalityToForm(value: string | undefined): string {
  if (!value) return '';
  const map: Record<string, string> = {
    'south african': 'South African',
    zimbabwean: 'Zimbabwean',
    botswana: 'Botswana',
    namibian: 'Namibian',
    mozambican: 'Mozambican',
    swazi: 'Swazi',
    lesotho: 'Lesotho',
    other: 'Other',
  };
  return map[value.toLowerCase()] ?? value;
}

function nationalityToFirestore(value: string): string {
  return value.toLowerCase();
}

function specialtyToForm(value: string | undefined): string {
  if (!value) return '';
  return value
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/&/g, '&');
}

function practiceTypeToForm(types: unknown): string {
  const first = Array.isArray(types) ? types[0] : types;
  if (typeof first !== 'string' || !first) return '';
  const map: Record<string, string> = {
    'in-practice': 'Solo Practice',
    telehealth: 'Group Practice',
    'home visit': 'Locum',
    'in hospital': 'Hospital-based',
  };
  return map[first.toLowerCase()] ?? 'Solo Practice';
}

function practiceTypeToFirestore(value: string): string[] {
  const map: Record<string, string> = {
    'Solo Practice': 'in-practice',
    'Group Practice': 'in-practice',
    'Hospital-based': 'in hospital',
    'Academic/Research': 'in-practice',
    Locum: 'home visit',
  };
  const mapped = map[value];
  return mapped ? [mapped] : ['in-practice'];
}

function facilityToForm(value: string | undefined): string {
  if (!value) return '';
  const map: Record<string, string> = {
    'private clinic': 'Private Clinic',
    'public hospital': 'Public Hospital',
    'private hospital': 'Private Hospital',
    'day hospital': 'Day Hospital',
    'community health center': 'Community Health Center',
  };
  return map[value.toLowerCase()] ?? value;
}

function facilityToFirestore(value: string): string {
  return value.toLowerCase();
}

function contactMethodToForm(methods: unknown): string {
  const first = Array.isArray(methods) ? methods[0] : methods;
  if (typeof first !== 'string' || !first) return '';
  const map: Record<string, string> = {
    phone: 'Phone',
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
  };
  return map[first.toLowerCase()] ?? '';
}

function contactMethodToFirestore(value: string): string[] {
  const map: Record<string, string> = {
    Phone: 'phone',
    Email: 'email',
    SMS: 'sms',
    WhatsApp: 'whatsapp',
  };
  const mapped = map[value];
  return mapped ? [mapped] : [];
}

export function firestoreToFormData(data: FirestoreDoctor): ProfessionalProfileFormData {
  const yearsRaw = data.yearsInPractice;
  const years =
    typeof yearsRaw === 'number'
      ? yearsNumberToRange(yearsRaw)
      : typeof yearsRaw === 'string' && yearsRaw in YEARS_RANGE_TO_NUMBER
        ? yearsRaw
        : '';

  const logo =
    (typeof data.logoUrl === 'string' && data.logoUrl) ||
    (typeof data.profileImageUrl === 'string' && data.profileImageUrl) ||
    '';

  return {
    title: titleToForm(
      typeof data.title === 'string' ? data.title : undefined
    ),
    fullName:
      (typeof data.fullName === 'string' && data.fullName) ||
      (typeof data.displayName === 'string' && data.displayName) ||
      '',
    gender: genderToForm(typeof data.gender === 'string' ? data.gender : undefined),
    idOrPassport:
      (typeof data.idOrPassportNumber === 'string' && data.idOrPassportNumber) ||
      (typeof data.idOrPassport === 'string' && data.idOrPassport) ||
      '',
    nationality: nationalityToForm(
      typeof data.nationality === 'string' ? data.nationality : undefined
    ),
    phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : '',
    emailAddress:
      (typeof data.email === 'string' && data.email) ||
      (typeof data.emailAddress === 'string' && data.emailAddress) ||
      '',
    preferredContactMethod: contactMethodToForm(data.preferredContactMethods),
    websiteOrSocialLink:
      typeof data.websiteOrSocialLink === 'string' ? data.websiteOrSocialLink : '',
    hpcsaRegistrationNumber:
      (typeof data.hpcsaRegistrationNumber === 'string' && data.hpcsaRegistrationNumber) ||
      (typeof data.licenseNumber === 'string' && data.licenseNumber) ||
      '',
    medicalSpecialty: specialtyToForm(
      (typeof data.medicalSpecialty === 'string' && data.medicalSpecialty) ||
        (typeof data.specialty === 'string' && data.specialty) ||
        undefined
    ),
    yearsOfExperience: years,
    hpcsaCertificate:
      (typeof data.hpcsaCertificateUrl === 'string' && data.hpcsaCertificateUrl) ||
      (typeof data.hpcsaCertificate === 'string' && data.hpcsaCertificate) ||
      '',
    practiceLicenceUrl:
      (typeof data.practiceLicenseUrl === 'string' && data.practiceLicenseUrl) ||
      (typeof data.practiceLicenceUrl === 'string' && data.practiceLicenceUrl) ||
      '',
    practiceType: practiceTypeToForm(data.practiceType),
    practiceName: typeof data.practiceName === 'string' ? data.practiceName : '',
    timezone:
      (typeof data.timezone === 'string' && data.timezone) ||
      (typeof data.practiceTimezone === 'string' && data.practiceTimezone) ||
      '',
    practiceNumber:
      (typeof data.practiceNumberBhf === 'string' && data.practiceNumberBhf) ||
      (typeof data.practiceNumber === 'string' && data.practiceNumber) ||
      '',
    vatNumber: typeof data.vatNumber === 'string' ? data.vatNumber : '',
    practiceFacility: facilityToForm(
      typeof data.practiceFacility === 'string' ? data.practiceFacility : undefined
    ),
    province:
      (typeof data.practiceProvince === 'string' && data.practiceProvince) ||
      (typeof data.province === 'string' && data.province) ||
      '',
    city:
      (typeof data.practiceCity === 'string' && data.practiceCity) ||
      (typeof data.city === 'string' && data.city) ||
      '',
    practiceAddress:
      (typeof data.practiceAddress === 'string' && data.practiceAddress) ||
      (typeof data.officeAddress === 'string' && data.officeAddress) ||
      '',
    logoUrl: logo,
  };
}

export function formDataToFirestore(
  form: ProfessionalProfileFormData,
  logoUrl?: string
): Record<string, unknown> {
  const years = YEARS_RANGE_TO_NUMBER[form.yearsOfExperience] ?? 0;
  const resolvedLogo = logoUrl ?? form.logoUrl;

  const payload: Record<string, unknown> = {
    title: titleToFirestore(form.title),
    fullName: form.fullName,
    displayName: form.fullName,
    gender: form.gender.toLowerCase(),
    idOrPassportNumber: form.idOrPassport,
    nationality: nationalityToFirestore(form.nationality),
    phoneNumber: form.phoneNumber,
    email: form.emailAddress,
    preferredContactMethods: contactMethodToFirestore(form.preferredContactMethod),
    websiteOrSocialLink: form.websiteOrSocialLink || null,
    hpcsaRegistrationNumber: form.hpcsaRegistrationNumber,
    medicalSpecialty: form.medicalSpecialty.toLowerCase(),
    yearsInPractice: years,
    hpcsaCertificateUrl: form.hpcsaCertificate || '',
    practiceLicenseUrl: form.practiceLicenceUrl || null,
    practiceType: practiceTypeToFirestore(form.practiceType),
    practiceName: form.practiceName,
    timezone: form.timezone || null,
    practiceTimezone: form.timezone || null,
    practiceNumberBhf: form.practiceNumber || null,
    vatNumber: form.vatNumber || null,
    practiceFacility: facilityToFirestore(form.practiceFacility),
    practiceProvince: form.province.toLowerCase(),
    practiceCity: form.city,
    practiceAddress: form.practiceAddress,
    specialty: form.medicalSpecialty,
    licenseNumber: form.hpcsaRegistrationNumber,
    officeAddress: form.practiceAddress,
  };

  if (resolvedLogo) {
    payload.logoUrl = resolvedLogo;
    payload.profileImageUrl = resolvedLogo;
  }

  return payload;
}
