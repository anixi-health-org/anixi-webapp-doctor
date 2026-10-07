/**
 * Medication adherence event model:
 *   Prescribed → Expected → Taken / Reported / Late / Missed
 * with practice-configurable time and % thresholds.
 */

export type AdherenceLifecycleStage =
  | 'prescribed'
  | 'expected'
  | 'taken'
  | 'reported'
  | 'late'
  | 'missed';

/** Display / aggregate dose outcomes used in the doctor portal */
export type AdherenceDoseOutcome =
  | 'expected'
  | 'taken'
  | 'reported'
  | 'late'
  | 'missed'
  | 'pending';

export type AdherenceRateBand = 'excellent' | 'moderate' | 'low' | 'no-data';

export type AdherenceRulesConfig = {
  version: 1;
  /** Minutes after scheduled time during which a take counts as on-time (taken). */
  lateWindowMinutes: number;
  /**
   * Minutes after scheduled time after which an untaken dose is treated as missed
   * (client-side when API still says pending).
   */
  missCutoffMinutes: number;
  /** Adherence % ≥ this → excellent */
  excellentMinPct: number;
  /** Adherence % ≥ this (and < excellent) → moderate */
  moderateMinPct: number;
  /** Used by caregiver / attention filters */
  attentionBelowPct: number;
  /** When true, late doses count toward taken in adherence % */
  countLateAsTaken: boolean;
  /** When true, pending doses still within the miss window are excluded from rate denom */
  excludeOpenPendingFromRate: boolean;
  updatedAt?: string;
};

export const DEFAULT_ADHERENCE_RULES: AdherenceRulesConfig = {
  version: 1,
  lateWindowMinutes: 60,
  missCutoffMinutes: 360, // 6 hours
  excellentMinPct: 85,
  moderateMinPct: 60,
  attentionBelowPct: 70,
  countLateAsTaken: true,
  excludeOpenPendingFromRate: false,
};

export function defaultAdherenceRules(): AdherenceRulesConfig {
  return { ...DEFAULT_ADHERENCE_RULES, updatedAt: new Date().toISOString() };
}

export function normalizeAdherenceRules(
  raw: Partial<AdherenceRulesConfig> | null | undefined
): AdherenceRulesConfig {
  const d = defaultAdherenceRules();
  if (!raw) return d;
  return {
    version: 1,
    lateWindowMinutes: clampInt(raw.lateWindowMinutes, 0, 24 * 60, d.lateWindowMinutes),
    missCutoffMinutes: clampInt(raw.missCutoffMinutes, 1, 7 * 24 * 60, d.missCutoffMinutes),
    excellentMinPct: clampInt(raw.excellentMinPct, 1, 100, d.excellentMinPct),
    moderateMinPct: clampInt(raw.moderateMinPct, 0, 99, d.moderateMinPct),
    attentionBelowPct: clampInt(raw.attentionBelowPct, 0, 100, d.attentionBelowPct),
    countLateAsTaken: raw.countLateAsTaken !== false,
    excludeOpenPendingFromRate: Boolean(raw.excludeOpenPendingFromRate),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export type ClassifyDoseInput = {
  /** Raw status from API */
  apiStatus?: string | null;
  scheduledTime: Date | null;
  takenTime?: Date | null;
  /** Optional report source — patient self-report vs device / caregiver */
  reportedBy?: string | null;
  now?: Date;
};

/**
 * Classify a scheduled dose into the event outcome model.
 * Pipeline: expected (future/open) → taken | reported | late | missed.
 */
export function classifyDoseEvent(
  input: ClassifyDoseInput,
  rules: AdherenceRulesConfig = DEFAULT_ADHERENCE_RULES
): AdherenceDoseOutcome {
  const now = input.now ?? new Date();
  const scheduled = input.scheduledTime;
  const takenAt = input.takenTime;
  const api = (input.apiStatus || '').toLowerCase();

  if (api === 'missed') return 'missed';

  if (takenAt || api === 'taken' || api === 'reported' || api === 'late') {
    if (!scheduled || !takenAt) {
      if (api === 'late') return 'late';
      if (api === 'reported' || input.reportedBy) return 'reported';
      return 'taken';
    }
    const delayMin = (takenAt.getTime() - scheduled.getTime()) / 60_000;
    if (delayMin > rules.lateWindowMinutes) return 'late';
    if (api === 'reported' || input.reportedBy) return 'reported';
    return 'taken';
  }

  if (!scheduled) return 'pending';

  const ageMin = (now.getTime() - scheduled.getTime()) / 60_000;
  if (ageMin < 0) return 'expected';
  if (ageMin > rules.missCutoffMinutes) return 'missed';
  return 'pending';
}

/** Map outcome to counters used by existing UI (taken / missed / pending). */
export function outcomeToLegacyBucket(
  outcome: AdherenceDoseOutcome,
  rules: AdherenceRulesConfig = DEFAULT_ADHERENCE_RULES
): 'taken' | 'missed' | 'pending' {
  switch (outcome) {
    case 'taken':
    case 'reported':
      return 'taken';
    case 'late':
      return rules.countLateAsTaken ? 'taken' : 'missed';
    case 'missed':
      return 'missed';
    case 'expected':
    case 'pending':
    default:
      return 'pending';
  }
}

export function labelFromAdherenceRate(
  rate: number,
  hasData: boolean,
  rules: AdherenceRulesConfig = DEFAULT_ADHERENCE_RULES
): AdherenceRateBand {
  if (!hasData) return 'no-data';
  if (rate >= rules.excellentMinPct) return 'excellent';
  if (rate >= rules.moderateMinPct) return 'moderate';
  return 'low';
}

export function calendarBandFromRate(
  rate: number,
  hasData: boolean,
  rules: AdherenceRulesConfig = DEFAULT_ADHERENCE_RULES
): 'excellent' | 'moderate' | 'low' | 'empty' {
  if (!hasData) return 'empty';
  if (rate >= rules.excellentMinPct) return 'excellent';
  if (rate >= rules.moderateMinPct) return 'moderate';
  return 'low';
}

export function outcomeLabel(outcome: AdherenceDoseOutcome): string {
  switch (outcome) {
    case 'expected':
      return 'Expected';
    case 'taken':
      return 'Taken';
    case 'reported':
      return 'Reported';
    case 'late':
      return 'Late';
    case 'missed':
      return 'Missed';
    case 'pending':
      return 'Pending';
    default:
      return 'Pending';
  }
}

export const ADHERENCE_EVENT_PIPELINE = [
  {
    stage: 'prescribed' as const,
    title: 'Prescribed',
    description: 'Medication is on the patient chart / care plan.',
  },
  {
    stage: 'expected' as const,
    title: 'Expected',
    description: 'A scheduled dose slot is due (or upcoming).',
  },
  {
    stage: 'taken' as const,
    title: 'Taken / Reported',
    description: 'Patient or caregiver records the dose within the late window.',
  },
  {
    stage: 'missed' as const,
    title: 'Missed',
    description: 'No take recorded before the miss cutoff (or marked missed).',
  },
] as const;
