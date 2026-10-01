import type { PracticePermissions, PracticeRole } from '../types';

/** Full access - practice owner */
export const OWNER_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: true,
  overrideConflicts: true,
  editBookingPolicies: true,
  managePatients: true,
  manageMembers: true,
  viewAllDoctors: true,
  viewBilling: true,
  manageContent: true,
};

/**
 * Administrator — ops admin with full practice control (same capability set as owner
 * for day-to-day work; ownership of the practice doc stays on `owner`).
 */
export const ADMINISTRATOR_PERMISSIONS: PracticePermissions = {
  ...OWNER_PERMISSIONS,
};

/** Day-to-day clinic operations without ownership transfer */
export const PRACTICE_MANAGER_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: true,
  overrideConflicts: true,
  editBookingPolicies: true,
  managePatients: true,
  manageMembers: true,
  viewAllDoctors: true,
  viewBilling: true,
  manageContent: true,
};

/** Clinician - own diary + patients; can see practice diary */
export const DOCTOR_MEMBER_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: true,
  overrideConflicts: true,
  editBookingPolicies: false,
  managePatients: true,
  manageMembers: false,
  viewAllDoctors: true,
  viewBilling: false,
  manageContent: false,
};

/**
 * Clinical associate — mid-level clinical support (vitals, patient flow, limited diary).
 */
export const CLINICAL_ASSOCIATE_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: true,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: true,
  manageMembers: false,
  viewAllDoctors: true,
  viewBilling: false,
  manageContent: false,
};

/** Registered nurse, clinical support, patient care, limited diary */
export const NURSE_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: true,
  manageMembers: false,
  viewAllDoctors: true,
  viewBilling: false,
  manageContent: false,
};

/** Allied health (physio, OT, etc.), own sessions + shared patients */
export const ALLIED_HEALTH_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: true,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: true,
  manageMembers: false,
  viewAllDoctors: true,
  viewBilling: false,
  manageContent: false,
};

/** Locum doctor, same clinical access as doctor, time-bound membership */
export const LOCUM_PERMISSIONS: PracticePermissions = {
  ...DOCTOR_MEMBER_PERMISSIONS,
};

/** Front desk - booking & patient registration */
export const RECEPTIONIST_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: true,
  manageMembers: false,
  viewAllDoctors: true,
  viewBilling: false,
  manageContent: false,
};

/** Billing - invoices & claims prep */
export const BILLING_CLERK_PERMISSIONS: PracticePermissions = {
  manageAppointments: false,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: true,
  manageMembers: false,
  viewAllDoctors: false,
  viewBilling: true,
  manageContent: false,
};

/** Content creator — education / content tooling only */
export const CONTENT_CREATOR_PERMISSIONS: PracticePermissions = {
  manageAppointments: false,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: false,
  manageMembers: false,
  viewAllDoctors: false,
  viewBilling: false,
  manageContent: true,
};

/** Legacy scheduling delegate */
export const DELEGATE_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: false,
  manageMembers: false,
  viewAllDoctors: false,
  viewBilling: false,
  manageContent: false,
};

export const ROLE_PERMISSION_PRESETS: Record<PracticeRole, PracticePermissions> = {
  owner: OWNER_PERMISSIONS,
  administrator: ADMINISTRATOR_PERMISSIONS,
  practice_manager: PRACTICE_MANAGER_PERMISSIONS,
  doctor: DOCTOR_MEMBER_PERMISSIONS,
  clinical_associate: CLINICAL_ASSOCIATE_PERMISSIONS,
  nurse: NURSE_PERMISSIONS,
  allied_health: ALLIED_HEALTH_PERMISSIONS,
  locum: LOCUM_PERMISSIONS,
  receptionist: RECEPTIONIST_PERMISSIONS,
  billing_clerk: BILLING_CLERK_PERMISSIONS,
  content_creator: CONTENT_CREATOR_PERMISSIONS,
  delegate: DELEGATE_PERMISSIONS,
};

export const ROLE_LABELS: Record<PracticeRole, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  practice_manager: 'Practice Manager',
  doctor: 'Doctor',
  clinical_associate: 'Clinical Associate',
  nurse: 'Nurse',
  allied_health: 'Allied Health',
  locum: 'Locum',
  receptionist: 'Receptionist',
  billing_clerk: 'Billing Clerk',
  content_creator: 'Content Creator',
  delegate: 'Delegate',
};

export const ROLE_DESCRIPTIONS: Record<PracticeRole, string> = {
  owner: 'Full control of the practice, members, billing, and settings',
  administrator: 'Administers practice operations, staff, billing, and content',
  practice_manager: 'Runs day-to-day clinic operations and staff',
  doctor: 'Sees patients, manages their diary and clinical work',
  clinical_associate: 'Supports clinical care with patient and diary access',
  nurse: 'Supports clinical care, vitals, and patient flow',
  allied_health: 'Allied health professional with their own session diary',
  locum: 'Temporary cover doctor with time-limited access',
  receptionist: 'Books appointments and registers patients',
  billing_clerk: 'Handles invoices and billing workflows',
  content_creator: 'Creates and manages patient education and practice content',
  delegate: 'Scheduling support for a specific doctor',
};

/**
 * Core product roles (invite / change-role UI).
 * Patient is an account role on the patient app, not invited as practice staff.
 */
export const CORE_PRACTICE_ROLES: PracticeRole[] = [
  'administrator',
  'practice_manager',
  'doctor',
  'clinical_associate',
  'receptionist',
  'content_creator',
];

/** Roles that can be invited by an owner / practice manager / administrator (core only). */
export const INVITABLE_ROLES: PracticeRole[] = [...CORE_PRACTICE_ROLES];

/**
 * Legacy / extended roles kept for existing members and role changes.
 * Not offered on new invites.
 */
export const LEGACY_PRACTICE_ROLES: PracticeRole[] = [
  'nurse',
  'allied_health',
  'locum',
  'billing_clerk',
  'delegate',
];

/** Roles assignable when editing an existing member (excludes owner) */
export const ASSIGNABLE_ROLES: PracticeRole[] = [
  ...CORE_PRACTICE_ROLES,
  ...LEGACY_PRACTICE_ROLES,
];

/**
 * Account-level roles outside practice membership.
 * `patient` lives on the patient app (health records / sharing), never as practice staff.
 */
export const CORE_ACCOUNT_ROLES = ['patient', 'doctor', 'caregiver', 'staff'] as const;
export type CoreAccountRole = (typeof CORE_ACCOUNT_ROLES)[number];

export const PATIENT_ACCOUNT_ROLE_NOTE =
  'Patient is an account-level role on the patient app. Patients are not invited into a practice as staff; clinicians share records with them instead.';

/** Bookable clinicians, appear in doctor lists and can hold diaries */
export function isClinicianRole(role: PracticeRole): boolean {
  return (
    role === 'doctor' ||
    role === 'clinical_associate' ||
    role === 'nurse' ||
    role === 'allied_health' ||
    role === 'locum'
  );
}

/** Ops / admin portal roles (non-clinical workspace by default) */
export function isAdminStaffRole(role: PracticeRole): boolean {
  return (
    role === 'owner' ||
    role === 'administrator' ||
    role === 'practice_manager' ||
    role === 'receptionist' ||
    role === 'billing_clerk' ||
    role === 'content_creator'
  );
}

export function permissionsForRole(role: PracticeRole): PracticePermissions {
  return { ...ROLE_PERMISSION_PRESETS[role] };
}

/** Merge older permission docs with new flags (defaults from role preset). */
export function normalizePermissions(
  raw: Partial<PracticePermissions> | undefined,
  role: PracticeRole = 'delegate'
): PracticePermissions {
  const preset = permissionsForRole(role);
  return {
    manageAppointments: raw?.manageAppointments ?? preset.manageAppointments,
    manageSoftBlocks: raw?.manageSoftBlocks ?? preset.manageSoftBlocks,
    overrideConflicts: raw?.overrideConflicts ?? preset.overrideConflicts,
    editBookingPolicies: raw?.editBookingPolicies ?? preset.editBookingPolicies,
    managePatients: raw?.managePatients ?? preset.managePatients,
    manageMembers: raw?.manageMembers ?? preset.manageMembers,
    viewAllDoctors: raw?.viewAllDoctors ?? preset.viewAllDoctors,
    viewBilling: raw?.viewBilling ?? preset.viewBilling,
    manageContent: raw?.manageContent ?? preset.manageContent,
  };
}

export const EMPTY_PERMISSIONS: PracticePermissions = {
  manageAppointments: false,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: false,
  manageMembers: false,
  viewAllDoctors: false,
  viewBilling: false,
  manageContent: false,
};
