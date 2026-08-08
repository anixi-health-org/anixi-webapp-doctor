import type { Doctor, PracticeSession, ProfessionalUser } from '../types';
import type { JoinPath } from '../types/auth';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';

/** Practice owner for a clinic org (portal admin — not the same as an invited clinician). */
export function isClinicOwner(session: PracticeSession | null): boolean {
  return (
    session?.practice?.orgType === 'clinic' && session?.member?.role === 'owner'
  );
}

/** Users who operate the clinic admin portal (not individual clinician workflows). */
export function usesClinicAdminPortal(session: PracticeSession | null): boolean {
  if (session?.practice?.orgType !== 'clinic') return false;
  const role = session.member?.role;
  if (role === 'owner' || role === 'practice_manager') return true;
  if (role === 'receptionist' || role === 'billing_clerk') {
    return session.member?.isClinician !== true;
  }
  return false;
}

export function clinicAdminHomePath(): string {
  return '/clinic';
}

/** Clinic owner who manages the practice but does not see patients */
export function isClinicAdminOwner(session: PracticeSession | null): boolean {
  return isClinicOwner(session) && session?.member?.isClinician === false;
}

export type DoctorVerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type DoctorAccessState =
  | 'onboarding'
  | 'under_review'
  | 'rejected'
  | 'suspended'
  | 'full';

/** Fields required before an application can be submitted for admin review. */
export const REQUIRED_ONBOARDING_FIELDS: (keyof ProfessionalProfileFormData)[] = [
  'title',
  'fullName',
  'gender',
  'idOrPassport',
  'nationality',
  'phoneNumber',
  'emailAddress',
  'hpcsaRegistrationNumber',
  'medicalSpecialty',
  'yearsOfExperience',
  'practiceType',
  'practiceName',
  'timezone',
  'practiceFacility',
  'province',
  'city',
  'practiceAddress',
];

export function isOnboardingFormComplete(form: ProfessionalProfileFormData): boolean {
  return REQUIRED_ONBOARDING_FIELDS.every((key) => {
    const value = form[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/**
 * Access rules:
 * - Legacy doctors with no verificationStatus → full access (grandfathered)
 * - New doctors start pending + applicationComplete false → onboarding
 * - Pending + application submitted → under review
 * - Approved → full app
 * - Rejected / suspended → status screens (login allowed)
 */
export function getDoctorAccessState(doctor: Doctor): DoctorAccessState {
  const status = doctor.verificationStatus;

  if (!status) {
    return 'full';
  }

  if (status === 'approved') {
    return 'full';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  if (status === 'suspended') {
    return 'suspended';
  }

  // pending
  if (!doctor.applicationComplete) {
    return 'onboarding';
  }

  return 'under_review';
}

export function doctorHomePath(doctor: Doctor): string {
  const state = getDoctorAccessState(doctor);
  switch (state) {
    case 'onboarding':
      return '/onboarding';
    case 'under_review':
    case 'rejected':
    case 'suspended':
      return '/account-review';
    default:
      return '/dashboard';
  }
}

export type HomePathOptions = {
  joinIntent?: JoinPath | string | null;
  hasPractice?: boolean;
  clinicOnboardingComplete?: boolean;
  /** Owner of a clinic org — uses clinic-setup, not doctor HPCSA onboarding */
  isClinicOwner?: boolean;
  /** Practice session for clinic-admin portal routing */
  practiceSession?: PracticeSession | null;
};

/**
 * Post-auth landing path.
 * Clinic owners → clinic-setup then /clinic.
 * Clinic staff (manager/reception/billing) → /clinic.
 * Invited doctors → clinical doctor portal.
 */
export function professionalHomePath(
  user: ProfessionalUser,
  options?: HomePathOptions
): string {
  if (user.role === 'caregiver') {
    return '/caregiver';
  }

  const session = options?.practiceSession ?? null;
  const clinicAdmin = usesClinicAdminPortal(session);
  const clinicOwner = options?.isClinicOwner || isClinicOwner(session);

  if (user.role === 'staff') {
    if (!options?.hasPractice && !session) {
      return '/join/invite';
    }
    if (clinicAdmin) {
      return clinicAdminHomePath();
    }
    return '/dashboard';
  }

  const joinIntent = options?.joinIntent;

  if (clinicOwner || joinIntent === 'clinic') {
    if (!options?.clinicOnboardingComplete) {
      return '/clinic-setup';
    }
    return clinicAdminHomePath();
  }

  if (clinicAdmin) {
    return clinicAdminHomePath();
  }

  if (!options?.hasPractice) {
    if (joinIntent === 'invite') {
      return '/join/invite';
    }
  }

  return doctorHomePath(user as Doctor);
}
