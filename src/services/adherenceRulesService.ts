import {
  defaultAdherenceRules,
  normalizeAdherenceRules,
  type AdherenceRulesConfig,
} from '../lib/adherenceEventModel';

const storageKey = (practiceId: string) => `anixi_adherence_rules_${practiceId}`;

let cachedPracticeId: string | null = null;

/** Let React session wire the active practice for non-React service calls. */
export function setAdherenceRulesPracticeContext(practiceId: string | null | undefined): void {
  cachedPracticeId = practiceId ?? null;
}

export function loadAdherenceRules(
  practiceId: string | null | undefined,
  overlay?: Partial<AdherenceRulesConfig> | null
): AdherenceRulesConfig {
  if (practiceId) {
    try {
      const raw = localStorage.getItem(storageKey(practiceId));
      if (raw) {
        return normalizeAdherenceRules(JSON.parse(raw) as Partial<AdherenceRulesConfig>);
      }
    } catch {
      /* fall through */
    }
  }
  if (overlay) return normalizeAdherenceRules(overlay);
  return defaultAdherenceRules();
}

export function saveAdherenceRules(
  practiceId: string,
  config: AdherenceRulesConfig
): AdherenceRulesConfig {
  const normalized = normalizeAdherenceRules({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(storageKey(practiceId), JSON.stringify(normalized));
  return normalized;
}

export function resetAdherenceRules(practiceId: string): AdherenceRulesConfig {
  const defaults = defaultAdherenceRules();
  localStorage.setItem(storageKey(practiceId), JSON.stringify(defaults));
  return defaults;
}

/** Sync helper for services that run outside React. */
export function getActiveAdherenceRules(practiceId?: string | null): AdherenceRulesConfig {
  return loadAdherenceRules(practiceId ?? cachedPracticeId);
}
