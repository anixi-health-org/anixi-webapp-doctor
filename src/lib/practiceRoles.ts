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
};

export const ROLE_PERMISSION_PRESETS: Record<PracticeRole, PracticePermissions> = {
  owner: OWNER_PERMISSIONS,
  practice_manager: PRACTICE_MANAGER_PERMISSIONS,
  doctor: DOCTOR_MEMBER_PERMISSIONS,
  receptionist: RECEPTIONIST_PERMISSIONS,
  billing_clerk: BILLING_CLERK_PERMISSIONS,
  delegate: DELEGATE_PERMISSIONS,
};

export const ROLE_LABELS: Record<PracticeRole, string> = {
  owner: 'Owner',
  practice_manager: 'Practice Manager',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  billing_clerk: 'Billing Clerk',
  delegate: 'Delegate',
};

export const ROLE_DESCRIPTIONS: Record<PracticeRole, string> = {
  owner: 'Full control of the practice, members, billing, and settings',
  practice_manager: 'Runs day-to-day clinic operations and staff',
  doctor: 'Sees patients, manages their diary and clinical work',
  receptionist: 'Books appointments and registers patients',
  billing_clerk: 'Handles invoices and billing workflows',
  delegate: 'Scheduling support for a specific doctor',
};

/** Roles that can be invited by an owner / practice manager */
export const INVITABLE_ROLES: PracticeRole[] = [
  'doctor',
  'practice_manager',
  'receptionist',
  'billing_clerk',
];

/** Bookable clinicians only — practice managers run ops, they are not diary doctors. */
export function isClinicianRole(role: PracticeRole): boolean {
  return role === 'doctor';
}

export function permissionsForRole(role: PracticeRole): PracticePermissions {
  return { ...ROLE_PERMISSION_PRESETS[role] };
}

/** Merge older 4-flag permission docs with new flags (defaults false). */
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
};
