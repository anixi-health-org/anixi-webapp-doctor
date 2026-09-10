import type { PracticeMember } from '../types';

/** Members from Django already include displayName/email when available. */
export async function enrichPracticeMembers(
  members: PracticeMember[],
): Promise<PracticeMember[]> {
  return members;
}

export function memberDisplayLabel(
  member: PracticeMember,
  ownerId?: string,
): string {
  if (member.displayName?.trim()) return member.displayName.trim();
  if (member.email?.trim()) return member.email.trim();
  if (member.uid === ownerId) return 'Clinic administrator';
  return 'Team member';
}
