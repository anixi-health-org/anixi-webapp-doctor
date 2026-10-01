import {
  defaultVitalRulesConfig,
  normalizeVitalRulesConfig,
  type VitalMetricRulesConfig,
} from '../lib/vitalMetricRules';

const storageKey = (practiceId: string) => `anixi_vital_rules_${practiceId}`;

/**
 * Load practice vital alert rules.
 * Prefer local overrides, then practice.vitalMetricRules from API, else defaults.
 */
export function loadVitalRules(
  practiceId: string | null | undefined,
  practiceOverlay?: VitalMetricRulesConfig | VitalMetricRulesConfig['metrics'] | null
): VitalMetricRulesConfig {
  if (practiceId) {
    try {
      const raw = localStorage.getItem(storageKey(practiceId));
      if (raw) {
        return normalizeVitalRulesConfig(JSON.parse(raw) as VitalMetricRulesConfig);
      }
    } catch {
      /* fall through */
    }
  }
  if (practiceOverlay) {
    return normalizeVitalRulesConfig(practiceOverlay);
  }
  return defaultVitalRulesConfig();
}

export function saveVitalRules(
  practiceId: string,
  config: VitalMetricRulesConfig
): VitalMetricRulesConfig {
  const normalized = normalizeVitalRulesConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(storageKey(practiceId), JSON.stringify(normalized));
  return normalized;
}

export function resetVitalRules(practiceId: string): VitalMetricRulesConfig {
  const defaults = defaultVitalRulesConfig();
  localStorage.setItem(storageKey(practiceId), JSON.stringify(defaults));
  return defaults;
}
