import type { Doctor } from '../types';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';

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
