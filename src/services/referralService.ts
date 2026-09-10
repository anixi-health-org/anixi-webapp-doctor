import { buildPatientSignupLink } from '../lib/referralLinks';

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
    // TODO: replace with a Django referral endpoint once available.
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
  } catch (error) {
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
  return buildPatientSignupLink(referralCode);
}
export const logInvitation = async (
  _doctorId: string,
  _targetEmail?: string,
  _method: 'link' | 'email' = 'link',
): Promise<string> => {
  // TODO: persist via Django referral endpoint once available.
  return `invitation-${Date.now()}`;
};
export const getReferralStats = async (
  _doctorId: string,
): Promise<{ sent: number; accepted: number }> => {
  // TODO: replace with a Django referral-stats endpoint once available.
  return { sent: 0, accepted: 0 };
};
