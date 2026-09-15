import type { Caregiver, Doctor, ProfessionalUser, StaffUser } from '../types';

type DjangoMe = Record<string, unknown>;
type DjangoDoctorProfile = Record<string, unknown>;

function readDoctorProfile(me: DjangoMe): DjangoDoctorProfile | undefined {
  return me.doctor_profile as DjangoDoctorProfile | undefined;
}

function readDate(value: unknown): Date {
  if (typeof value === 'string' && value) return new Date(value);
  return new Date();
}

export function mapDjangoMeToDoctor(me: DjangoMe): Doctor {
  const profile = readDoctorProfile(me) ?? {};
  return {
    id: String(me.id),
    email: String(me.email ?? ''),
    displayName: String(me.display_name ?? profile.display_name ?? ''),
    role: 'doctor',
    specialty:
      (profile.specialty as string | undefined) ||
      (profile.medical_specialty as string | undefined),
    licenseNumber:
      (profile.license_number as string | undefined) ||
      (profile.hpcsa_registration_number as string | undefined),
    phoneNumber: (me.phone_number as string | undefined) || undefined,
    officeAddress: profile.office_address as string | undefined,
    practiceName: profile.practice_name as string | undefined,
    logoUrl: profile.logo_url as string | undefined,
    profileImageUrl: profile.profile_image_url as string | undefined,
    practiceNumberBhf: profile.practice_number_bhf as string | undefined,
    vatNumber: profile.vat_number as string | undefined,
    country: me.country as string | undefined,
    currency: me.currency as string | undefined,
    nationality: profile.nationality as string | undefined,
    verificationStatus: profile.verification_status as Doctor['verificationStatus'],
    accountKind: profile.account_kind as Doctor['accountKind'],
    requiresClinicalVerification:
      profile.requires_clinical_verification === undefined
        ? undefined
        : Boolean(profile.requires_clinical_verification),
    applicationComplete: Boolean(profile.application_complete),
    applicationSubmittedAt: profile.application_submitted_at
      ? readDate(profile.application_submitted_at)
      : undefined,
    verifiedAt: profile.verified_at ? readDate(profile.verified_at) : undefined,
    rejectionReason: profile.rejection_reason as string | undefined,
    createdAt: readDate(me.created_at),
    updatedAt: readDate(me.updated_at),
  };
}

export function mapDjangoMeToProfessionalUser(me: DjangoMe): ProfessionalUser {
  const role = String(me.role ?? '');
  if (role === 'admin' || role === 'patient') {
    throw new Error(
      'This account cannot sign in to the doctor portal. Use the Anixi Health admin portal.',
    );
  }
  if (role === 'staff') {
    return {
      id: String(me.id),
      email: String(me.email ?? ''),
      displayName: String(me.display_name ?? ''),
      role: 'staff',
      phoneNumber: me.phone_number as string | undefined,
      createdAt: readDate(me.created_at),
      updatedAt: readDate(me.updated_at),
    } satisfies StaffUser;
  }
  if (role === 'caregiver') {
    return {
      id: String(me.id),
      email: String(me.email ?? ''),
      displayName: String(me.display_name ?? ''),
      role: 'caregiver',
      phoneNumber: me.phone_number as string | undefined,
      createdAt: readDate(me.created_at),
      updatedAt: readDate(me.updated_at),
    } satisfies Caregiver;
  }
  return mapDjangoMeToDoctor(me);
}
