import type { AskAnixiContext } from '../services/askAnixiService';
import type { PracticeDashboardStats } from '../services/practiceDashboardService';
import type { PracticeSnapshot } from '../hooks/useDoctorBriefingData';
import { unichartContextFields } from './ayahUnichartContext';
import type { UnichartPreview } from '../services/djangoApiService';

export type AyahClientSurface =
  | 'doctor-ayah'
  | 'clinic-ayah'
  | 'dashboard-ayah'
  | 'onboarding-ayah'
  | 'post-consult'
  | 'voice'
  | 'copilot';

export function resolveClinicAnchors(timezone?: string): Pick<
  AskAnixiContext,
  'clinicDate' | 'clinicTimezone'
> {
  const clinicTimezone = timezone?.trim() || 'Africa/Johannesburg';
  const clinicDate = new Date().toLocaleDateString('en-CA', { timeZone: clinicTimezone });
  return { clinicDate, clinicTimezone };
}

export function resolveAyahThreadId(options: {
  surface: AyahClientSurface;
  userId: string;
  patientId?: string;
  appointmentId?: string;
}): string {
  const { surface, userId, patientId, appointmentId } = options;
  if (surface === 'dashboard-ayah') return `${userId}:dashboard`;
  if (surface === 'onboarding-ayah') return `onboarding-${userId}`;
  if (surface === 'post-consult' && patientId && appointmentId) {
    return `${patientId}:${appointmentId}:scribe`;
  }
  if (surface === 'voice' && patientId) return `${userId}:${patientId}:voice`;
  if (surface === 'clinic-ayah') return `${userId}:clinic-ayah`;
  if (patientId) return `${userId}:${patientId}`;
  return userId;
}

export function buildClinicOpsPracticeSnapshot(input: {
  practiceId?: string;
  name?: string;
  timezone: string;
  stats: PracticeDashboardStats | null;
}): Record<string, unknown> {
  const stats = input.stats;
  return {
    practiceId: input.practiceId,
    name: input.name,
    timezone: input.timezone,
    pendingAppointments: stats?.pendingAppointments ?? 0,
    counts: {
      today: stats?.appointmentsToday ?? 0,
      pendingAppointments: stats?.pendingAppointments ?? 0,
      patients: stats?.rosterPatients ?? 0,
      pendingInvites: stats?.pendingInvites ?? 0,
      activeMembers: stats?.activeMembers ?? 0,
    },
  };
}

export function mergeCompanionRequestContext(
  base: AskAnixiContext,
  enrich: Partial<AskAnixiContext> & {
    clientSurface?: AyahClientSurface;
    preferredLanguage?: string;
    unichartPreview?: UnichartPreview | null;
  },
): AskAnixiContext {
  const unichartFields = enrich.unichartPreview
    ? unichartContextFields(enrich.unichartPreview)
    : {};
  const { unichartPreview: _drop, clientSurface, preferredLanguage, ...rest } = enrich;
  return {
    ...base,
    ...rest,
    ...unichartFields,
    ...(clientSurface ? { clientSurface } : {}),
    ...(preferredLanguage ? { preferredLanguage } : {}),
  };
}

export function practiceSnapshotToContext(
  snapshot: PracticeSnapshot,
): Record<string, unknown> {
  return snapshot as unknown as Record<string, unknown>;
}
