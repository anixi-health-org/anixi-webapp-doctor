import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import type { PracticeMember } from '../types';

/** Fill missing member name/email from Users and doctors profiles. */
export async function enrichPracticeMembers(
  members: PracticeMember[]
): Promise<PracticeMember[]> {
  return Promise.all(
    members.map(async (member) => {
      if (member.displayName?.trim() && member.email?.trim()) {
        return member;
      }

      const [userSnap, doctorSnap] = await Promise.all([
        getDoc(doc(db, USERS_COLLECTION, member.uid)),
        getDoc(doc(db, DOCTORS_COLLECTION, member.uid)),
      ]);

      const userData = userSnap.exists() ? userSnap.data() : {};
      const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};

      const displayName =
        member.displayName?.trim() ||
        (typeof userData.displayName === 'string' && userData.displayName.trim()) ||
        (typeof doctorData.fullName === 'string' && doctorData.fullName.trim()) ||
        (typeof doctorData.displayName === 'string' && doctorData.displayName.trim()) ||
        undefined;

      const email =
        member.email?.trim() ||
        (typeof userData.email === 'string' && userData.email.trim()) ||
        (typeof doctorData.email === 'string' && doctorData.email.trim()) ||
        undefined;

      return {
        ...member,
        displayName,
        email,
      };
    })
  );
}

export function memberDisplayLabel(
  member: PracticeMember,
  ownerId?: string
): string {
  if (member.displayName?.trim()) return member.displayName.trim();
  if (member.email?.trim()) return member.email.trim();
  if (member.uid === ownerId) return 'Clinic administrator';
  return 'Team member';
}
