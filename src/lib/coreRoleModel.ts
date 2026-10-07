/**
 * Core Anixi role model — practice staff + account-level roles.
 * Practice membership permissions live in practiceRoles.ts.
 * Patient is account-level (patient app), not a practice member role.
 */

export {
  CORE_PRACTICE_ROLES,
  CORE_ACCOUNT_ROLES,
  ROLE_PERMISSION_PRESETS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  INVITABLE_ROLES,
  ASSIGNABLE_ROLES,
  LEGACY_PRACTICE_ROLES,
  PATIENT_ACCOUNT_ROLE_NOTE,
  permissionsForRole,
  isClinicianRole,
  isAdminStaffRole,
  normalizePermissions,
} from '../lib/practiceRoles';

export type { CoreAccountRole } from '../lib/practiceRoles';
export type { PracticeRole, PracticePermissions } from '../types';

/** Human-readable matrix for product / docs */
export const CORE_ROLE_PERMISSION_SUMMARY = {
  receptionist: ['manageAppointments', 'managePatients', 'viewAllDoctors'],
  doctor: [
    'manageAppointments',
    'manageSoftBlocks',
    'overrideConflicts',
    'managePatients',
    'viewAllDoctors',
  ],
  practice_manager: [
    'manageAppointments',
    'manageSoftBlocks',
    'overrideConflicts',
    'editBookingPolicies',
    'managePatients',
    'manageMembers',
    'viewAllDoctors',
    'viewBilling',
    'manageContent',
  ],
  clinical_associate: [
    'manageAppointments',
    'manageSoftBlocks',
    'managePatients',
    'viewAllDoctors',
  ],
  administrator: [
    'manageAppointments',
    'manageSoftBlocks',
    'overrideConflicts',
    'editBookingPolicies',
    'managePatients',
    'manageMembers',
    'viewAllDoctors',
    'viewBilling',
    'manageContent',
  ],
  content_creator: ['manageContent'],
  patient: [] as string[], // patient app account — sharing / health data, not practice flags
} as const;
