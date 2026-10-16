import type { PracticeRole } from '../types';
import { clinicianGivenName, clinicianHeaderLabel } from './clinicianName';
import { formatRoleList, normalizeMemberRoles } from './practiceRoles';

/** Roles that use the Dr. honorific in headers and greetings (registered medical practitioners). */
const DOCTOR_HONORIFIC_ROLES: PracticeRole[] = ['doctor', 'locum'];

export function memberUsesDoctorHonorific(roles: PracticeRole[]): boolean {
  const normalized = normalizeMemberRoles('delegate', roles);
  return normalized.some((role) => DOCTOR_HONORIFIC_ROLES.includes(role));
}

/** Subtitle under the user name in the portal header (e.g. Clinical Associate, Receptionist). */
export function practiceMemberSubtitle(roles: PracticeRole[]): string | null {
  const normalized = normalizeMemberRoles('delegate', roles);
  if (!normalized.length || (normalized.length === 1 && normalized[0] === 'delegate')) {
    return null;
  }
  return formatRoleList(normalized);
}

export function practiceMemberHeaderLabel(
  displayName: string | undefined | null,
  roles: PracticeRole[],
): string {
  const trimmed = (displayName || '').trim();
  if (!trimmed) return 'Team member';
  if (memberUsesDoctorHonorific(roles)) {
    return clinicianHeaderLabel(trimmed);
  }
  const given = trimmed.split(/\s+/).filter(Boolean)[0];
  return given || trimmed;
}

/** First name (or given name) for welcome lines — Dr. prefix only when honorific applies. */
export function practiceMemberWelcomeName(
  displayName: string | undefined | null,
  roles: PracticeRole[],
): string {
  const trimmed = (displayName || '').trim();
  if (!trimmed) {
    return memberUsesDoctorHonorific(roles) ? 'Doctor' : 'there';
  }
  if (memberUsesDoctorHonorific(roles)) {
    return clinicianGivenName(trimmed);
  }
  return trimmed.split(/\s+/).filter(Boolean)[0] || trimmed;
}

/** Greeting fragment after "Good morning," — includes Dr. when appropriate. */
export function practiceMemberGreetingLabel(
  displayName: string | undefined | null,
  roles: PracticeRole[],
): string {
  const trimmed = (displayName || '').trim();
  if (!trimmed) return memberUsesDoctorHonorific(roles) ? 'Doctor' : 'there';
  if (memberUsesDoctorHonorific(roles)) {
    return clinicianHeaderLabel(trimmed);
  }
  return practiceMemberWelcomeName(trimmed, roles);
}
