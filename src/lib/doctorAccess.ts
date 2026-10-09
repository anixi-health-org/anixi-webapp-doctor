import type { Doctor, Practice, PracticeSession, ProfessionalUser } from '../types';
import type { JoinPath } from '../types/auth';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';
import { normalizeBillingProfile } from './practiceBillingProfile';

/** Clinic and hospital share one access model. Solo is a private practice. */
export function isManagedOrgType(orgType: string | null | undefined): boolean {
  return orgType === 'clinic' || orgType === 'hospital';
}

export function parsePracticeOrgType(value: unknown): 'solo' | 'clinic' | 'hospital' {
  if (value === 'clinic' || value === 'hospital' || value === 'solo') return value;
  return 'solo';
}

/** Practice owner for a clinic or hospital (portal admin, not an invited clinician). */
export function isClinicOwner(session: PracticeSession | null): boolean {
  return isManagedOrgType(session?.practice?.orgType) && session?.member?.role === 'owner';
}

/** Users who operate the clinic admin portal (not individual clinician workflows). */
export function usesClinicAdminPortal(session: PracticeSession | null): boolean {
  if (!session || !isManagedOrgType(session.practice?.orgType)) return false;
  const role = session.member?.role;
  if (
    role === 'owner' ||
    role === 'administrator' ||
    role === 'practice_manager' ||
    role === 'content_creator'
  ) {
    return true;
  }
  if (role === 'receptionist' || role === 'billing_clerk') {
    return session.member?.isClinician !== true;
  }
  return false;
}

/** Owner, administrator, and practice manager can switch clinic ops ↔ clinical workspace. */
export function canSwitchWorkspaces(session: PracticeSession | null): boolean {
  if (!session || !isManagedOrgType(session.practice?.orgType)) return false;
  const role = session.member?.role;
  return role === 'owner' || role === 'administrator' || role === 'practice_manager';
}

export type ClinicEmployedHints = {
  joinIntent?: string | null;
  accountKind?: Doctor['accountKind'];
};

/**
 * Invited clinicians at a hospital/clinic — bookings, branding, and rules are
 * managed by clinic admin staff, not the individual doctor or nurse.
 */
export function isClinicEmployedClinician(
  session: PracticeSession | null,
  hints?: ClinicEmployedHints,
): boolean {
  if (session && isManagedOrgType(session.practice?.orgType)) {
    if (canSwitchWorkspaces(session)) return false;
    const role = session.member?.role;
    if (role === 'doctor' || role === 'nurse' || session.member?.isClinician === true) {
      return true;
    }
    return false;
  }

  if (!session && hints?.joinIntent === 'invite') {
    return true;
  }

  return false;
}

/** Private / independent practice — the doctor owns branding, billing, hours, and roster. */
export function isIndependentPractice(session: PracticeSession | null): boolean {
  return !isManagedOrgType(session?.practice?.orgType);
}

/** Hospital/clinic org — front desk and clinic admin own ops; employed doctors do not. */
export function isClinicManagedPractice(session: PracticeSession | null): boolean {
  return isManagedOrgType(session?.practice?.orgType);
}

/** Who may edit operational settings (hours, blocks, branding, booking rules). */
export function canManageOperationalSettings(session: PracticeSession | null): boolean {
  if (!session?.practice) return false;
  if (!isManagedOrgType(session.practice.orgType)) {
    const role = session.member?.role;
    if (role === 'owner') return true;
    const permissions = session.member?.permissions;
    return Boolean(
      permissions?.manageAppointments ||
        permissions?.editBookingPolicies ||
        permissions?.manageMembers
    );
  }
  if (canSwitchWorkspaces(session)) return true;
  if (session.member?.isClinician === true) return false;
  const role = session.member?.role;
  if (role === 'receptionist' || role === 'billing_clerk' || role === 'content_creator') {
    return true;
  }
  const permissions = session.member?.permissions;
  return Boolean(
    permissions?.manageAppointments ||
      permissions?.editBookingPolicies ||
      permissions?.manageMembers
  );
}

export function clinicAdminHomePath(_session?: PracticeSession | null): string {
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
  | 'suspended'
  | 'on_hold'
  | 'not_required';

export type DoctorAccessState =
  | 'onboarding'
  | 'under_review'
  | 'on_hold'
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

/** Clinic org owns these; invited doctors should not re-enter them. */
export const CLINIC_INHERITED_ONBOARDING_FIELDS: (keyof ProfessionalProfileFormData)[] = [
  'practiceType',
  'practiceName',
  'timezone',
  'practiceFacility',
  'province',
  'city',
  'practiceAddress',
];

type OnboardingCompleteOptions = {
  inheritPracticeFromClinic?: boolean;
};

export function isOnboardingFormComplete(
  form: ProfessionalProfileFormData,
  options?: OnboardingCompleteOptions,
): boolean {
  const skip = options?.inheritPracticeFromClinic
    ? new Set(CLINIC_INHERITED_ONBOARDING_FIELDS)
    : new Set<keyof ProfessionalProfileFormData>();
  return REQUIRED_ONBOARDING_FIELDS.every((key) => {
    if (skip.has(key)) return true;
    const value = form[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/** Snapshot clinic-owned practice fields onto an invited doctor's profile form. */
export function inheritClinicPracticeFields(
  practice: Practice,
): Partial<ProfessionalProfileFormData> {
  const primary = Array.isArray(practice.locations) ? practice.locations[0] : undefined;
  const listing = practice.publicListing;
  const locationType = primary?.type;
  const province = String(listing?.province || '').trim().toLowerCase();
  const city = String(listing?.city || '').trim();
  const address = String(primary?.address || '').trim();

  const billing = normalizeBillingProfile(practice.billingProfile);

  return {
    practiceType: locationType === 'hospital' || isManagedOrgType(practice.orgType)
      ? 'Hospital-based'
      : 'Group Practice',
    practiceName: (practice.tradingName || practice.name || '').trim(),
    timezone: practice.timezone || 'Africa/Johannesburg',
    practiceNumber: (practice.bhfPracticeNumber || '').trim(),
    vatNumber: (billing.vatNumber || '').trim(),
    practiceFacility: locationType === 'hospital' ? 'Private Hospital' : 'Private Clinic',
    province,
    city,
    practiceAddress: address,
    logoUrl: (practice.logoUrl || '').trim(),
  };
}

/** Clinic-employed physicians use the parent practice for ops, billing, and letterhead. */
export function shouldInheritClinicPracticeSettings(
  practiceSession: PracticeSession | null,
  clinicEmployed: boolean,
): boolean {
  return (
    clinicEmployed &&
    Boolean(practiceSession?.practice) &&
    isManagedOrgType(practiceSession?.practice?.orgType)
  );
}

/** Merge parent clinic branding and billing onto the doctor record for clinical workflows. */
export function mergeDoctorWithClinicPractice(doctor: Doctor, practice: Practice): Doctor {
  const inherited = inheritClinicPracticeFields(practice);
  return {
    ...doctor,
    practiceName: inherited.practiceName || doctor.practiceName,
    officeAddress: inherited.practiceAddress || doctor.officeAddress,
    practiceNumberBhf: inherited.practiceNumber || doctor.practiceNumberBhf,
    vatNumber: inherited.vatNumber || doctor.vatNumber,
    logoUrl: inherited.logoUrl || doctor.logoUrl,
  };
}

/**
 * Access rules:
 * - Legacy doctors with no verificationStatus → full access (grandfathered)
 * - Clinic admins (not clinicians) → full clinic portal access (no HPCSA review)
 * - New doctors start pending + applicationComplete false → onboarding
 * - Pending + application submitted → under review
 * - Approved → full app
 * - Rejected / suspended → status screens (login allowed)
 */
export function getDoctorAccessState(doctor: Doctor): DoctorAccessState {
  const status = doctor.verificationStatus;

  if (status === 'suspended') {
    return 'suspended';
  }
  if (status === 'on_hold') {
    return 'on_hold';
  }

  if (
    doctor.accountKind === 'clinic_admin' ||
    doctor.requiresClinicalVerification === false ||
    status === 'not_required'
  ) {
    return 'full';
  }

  if (!status) {
    return 'full';
  }

  if (status === 'approved') {
    return 'full';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

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
    case 'on_hold':
    case 'rejected':
    case 'suspended':
      return '/account-review';
    default:
      return '/ayah';
  }
}

export type HomePathOptions = {
  joinIntent?: JoinPath | string | null;
  hasPractice?: boolean;
  clinicOnboardingComplete?: boolean;
  /** Owner of a clinic org, uses clinic-setup, not doctor HPCSA onboarding */
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

  if (user.role === 'doctor') {
    const access = getDoctorAccessState(user as Doctor);
    if (access === 'suspended' || access === 'on_hold' || access === 'rejected') {
      return '/account-review';
    }
  }

  if (user.role === 'staff') {
    if (options?.joinIntent === 'market_partner') {
      return '/partner';
    }
    if (!options?.hasPractice && !session) {
      return '/invites/pending';
    }
    if (clinicAdmin) {
      return clinicAdminHomePath(session);
    }
    return '/dashboard';
  }

  const joinIntent = options?.joinIntent;

  if (clinicOwner || joinIntent === 'clinic') {
    if (!options?.clinicOnboardingComplete) {
      return '/clinic-setup';
    }
    return clinicAdminHomePath(session);
  }

  if (clinicAdmin) {
    return clinicAdminHomePath(session);
  }

  if (!options?.hasPractice) {
    if (joinIntent === 'invite') {
      return '/invites/pending';
    }
  }

  return doctorHomePath(user as Doctor);
}
