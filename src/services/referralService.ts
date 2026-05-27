import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
export interface Referral {
  id: string;
  doctorId: string;
  referralCode: string;
  referralLink: string;
  createdAt: Date;
  invitationsSent: number;
  invitationsAccepted: number;
  lastInvitedAt?: Date;
}
export interface Invitation {
  id: string;
  referralId: string;
  doctorId: string;
  targetEmail?: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
  acceptedAt?: Date;
}
export const getDoctorReferral = async (doctorId: string): Promise<Referral | null> => {
  try {
    const docRef = doc(db, 'referrals', doctorId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        doctorId,
        referralCode: data.referralCode,
        referralLink: data.referralLink,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        invitationsSent: data.invitationsSent || 0,
        invitationsAccepted: data.invitationsAccepted || 0,
        lastInvitedAt: data.lastInvitedAt?.toDate?.(),
      };
    }
    const referralCode = generateReferralCode(doctorId);
    const referralLink = generateReferralLink(referralCode);
    await setDoc(docRef, {
      doctorId,
      referralCode,
      referralLink,
      createdAt: serverTimestamp(),
      invitationsSent: 0,
      invitationsAccepted: 0,
    });
    return {
      id: doctorId,
      doctorId,
      referralCode,
      referralLink,
      createdAt: new Date(),
      invitationsSent: 0,
      invitationsAccepted: 0,
    };
  } catch (error) {
    ;
    const referralCode = generateReferralCode(doctorId);
    const referralLink = generateReferralLink(referralCode);
    return {
      id: doctorId,
      doctorId,
      referralCode,
      referralLink,
      createdAt: new Date(),
      invitationsSent: 0,
      invitationsAccepted: 0,
    };
  }
};
function generateReferralCode(doctorId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${timestamp}${random}`.substring(0, 12);
}
function generateReferralLink(referralCode: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/sign-up?ref=${referralCode}`;
}
export const logInvitation = async (
  doctorId: string,
  targetEmail?: string,
  method: 'link' | 'email' = 'link'
): Promise<string> => {
  try {
    const ref = doc(db, 'referrals', doctorId);
    const referralDoc = await getDoc(ref);

    if (!referralDoc.exists()) {
      const referralCode = generateReferralCode(doctorId);
      await setDoc(ref, {
        doctorId,
        referralCode,
        referralLink: generateReferralLink(referralCode),
        createdAt: serverTimestamp(),
        invitationsSent: 1,
        invitationsAccepted: 0,
        lastInvitedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(ref, {
        invitationsSent: increment(1),
        lastInvitedAt: serverTimestamp(),
      }, { merge: true });
    }

    const invitationRef = doc(collection(db, 'referrals', doctorId, 'invitations'));
    await setDoc(invitationRef, {
      doctorId,
      targetEmail: targetEmail || 'direct_link',
      method,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return invitationRef.id;
  } catch (error) {
    ;
    throw error;
  }
};
export const getReferralStats = async (
  doctorId: string
): Promise<{ sent: number; accepted: number }> => {
  try {
    const referral = await getDoctorReferral(doctorId);
    if (!referral) {
      return { sent: 0, accepted: 0 };
    }
    return {
      sent: referral.invitationsSent,
      accepted: referral.invitationsAccepted,
    };
  } catch (error) {
    ;
    return { sent: 0, accepted: 0 };
  }
};
