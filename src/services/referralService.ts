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

const INVITE_STATS_KEY = 'anixi.referralStats';

type StoredReferralStats = {
  sent: number;
  accepted: number;
  lastInvitedAt?: string;
};

function readStoredStats(doctorId: string): StoredReferralStats {
  try {
    const raw = localStorage.getItem(`${INVITE_STATS_KEY}.${doctorId}`);
    if (!raw) return { sent: 0, accepted: 0 };
    const parsed = JSON.parse(raw) as StoredReferralStats;
    return {
      sent: Number(parsed.sent) || 0,
      accepted: Number(parsed.accepted) || 0,
      lastInvitedAt: parsed.lastInvitedAt,
    };
  } catch {
    return { sent: 0, accepted: 0 };
  }
}

function writeStoredStats(doctorId: string, stats: StoredReferralStats): void {
  try {
    localStorage.setItem(`${INVITE_STATS_KEY}.${doctorId}`, JSON.stringify(stats));
  } catch {
    // ignore quota errors
  }
}

/** Stable referral code derived from doctor id (no server persistence yet). */
function generateReferralCode(doctorId: string): string {
  let hash = 0;
  for (let i = 0; i < doctorId.length; i += 1) {
    hash = (hash << 5) - hash + doctorId.charCodeAt(i);
    hash |= 0;
  }
  return `AX${Math.abs(hash).toString(36).toUpperCase().slice(0, 8)}`;
}

function generateReferralLink(referralCode: string): string {
  return buildPatientSignupLink(referralCode);
}

export const getDoctorReferral = async (doctorId: string): Promise<Referral | null> => {
  const referralCode = generateReferralCode(doctorId);
  const referralLink = generateReferralLink(referralCode);
  const stats = readStoredStats(doctorId);
  return {
    id: doctorId,
    doctorId,
    referralCode,
    referralLink,
    createdAt: new Date(),
    invitationsSent: stats.sent,
    invitationsAccepted: stats.accepted,
    lastInvitedAt: stats.lastInvitedAt ? new Date(stats.lastInvitedAt) : undefined,
  };
};

export const logInvitation = async (
  doctorId: string,
  _targetEmail?: string,
  _method: 'link' | 'email' = 'link',
): Promise<string> => {
  const stats = readStoredStats(doctorId);
  const next = {
    ...stats,
    sent: stats.sent + 1,
    lastInvitedAt: new Date().toISOString(),
  };
  writeStoredStats(doctorId, next);
  return `invitation-${Date.now()}`;
};

export const getReferralStats = async (
  doctorId: string,
): Promise<{ sent: number; accepted: number }> => {
  const stats = readStoredStats(doctorId);
  return { sent: stats.sent, accepted: stats.accepted };
};
