import type { BookingPolicy, Practice, PracticeMember, PracticePermissions, PracticeSession } from '../types';
import { normalizePermissions } from '../lib/practiceRoles';
import { djangoGetPracticeSession, djangoResolveMediaUrl } from './djangoApiService';

const EMPTY_PERMISSIONS: PracticePermissions = {
  manageAppointments: false,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
  managePatients: false,
  manageMembers: false,
  viewAllDoctors: false,
  viewBilling: false,
};

function parsePractice(raw: Record<string, unknown>): Practice {
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'Practice'),
    timezone: String(raw.timezone ?? 'Africa/Johannesburg'),
    ownerId: String(raw.ownerId ?? ''),
    orgType: raw.orgType === 'clinic' ? 'clinic' : 'solo',
    tradingName: raw.tradingName ? String(raw.tradingName) : undefined,
    bhfPracticeNumber: raw.bhfPracticeNumber ? String(raw.bhfPracticeNumber) : undefined,
    locations: Array.isArray(raw.locations) ? (raw.locations as Practice['locations']) : [],
    rooms: Array.isArray(raw.rooms) ? (raw.rooms as Practice['rooms']) : [],
    consultTypes: Array.isArray(raw.consultTypes) ? (raw.consultTypes as Practice['consultTypes']) : [],
    consultTypeSettings: Array.isArray(raw.consultTypeSettings)
      ? (raw.consultTypeSettings as Practice['consultTypeSettings'])
      : undefined,
    publicListing: (raw.publicListing as Practice['publicListing']) ?? undefined,
    clinicCode: raw.clinicCode ? String(raw.clinicCode) : undefined,
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
  };
}

function parseMember(raw: Record<string, unknown>): PracticeMember {
  const role = (raw.role as PracticeMember['role']) ?? 'delegate';
  const rawPermissions = (raw.permissions as Partial<PracticePermissions> | undefined) ?? {};
  return {
    uid: String(raw.uid),
    practiceId: String(raw.practiceId),
    role,
    // Empty {} from older solo-owner rows must fall back to role presets.
    permissions: normalizePermissions(rawPermissions, role),
    status: (raw.status as PracticeMember['status']) ?? 'active',
    isClinician: Boolean(raw.isClinician),
    displayName: raw.displayName ? String(raw.displayName) : undefined,
    email: raw.email ? String(raw.email) : undefined,
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
  };
}

function parseBookingPolicy(raw: Record<string, unknown>): BookingPolicy {
  return {
    practiceId: String(raw.practiceId),
    patientCancellationWindowHours: Number(raw.patientCancellationWindowHours ?? 24),
    doctorCancellationWindowHours: Number(raw.doctorCancellationWindowHours ?? 2),
    noShowPolicyText: String(raw.noShowPolicyText ?? ''),
    confirmationMode:
      raw.confirmationMode === 'doctor_confirms' || raw.confirmationMode === 'manual'
        ? 'doctor_confirms'
        : 'auto',
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
  };
}

/** Load authoritative practice session from Django (real role + permissions). */
export async function loadDjangoPracticeSession(_uid: string): Promise<PracticeSession | null> {
  const payload = await djangoGetPracticeSession();
  if (!payload) return null;

  const practice = parsePractice(payload.practice as Record<string, unknown>);
  const resolvedLogo = await djangoResolveMediaUrl(practice.logoUrl);
  const member = parseMember(payload.member as Record<string, unknown>);
  const bookingPolicy = parseBookingPolicy(payload.bookingPolicy as Record<string, unknown>);

  return {
    practice: resolvedLogo ? { ...practice, logoUrl: resolvedLogo } : practice,
    member,
    bookingPolicy,
  };
}
