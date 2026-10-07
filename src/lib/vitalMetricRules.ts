/**
 * Configurable vital / metric alert rules with normal | warning | urgent bands.
 * Defaults are adult clinical heuristics; practices can override per metric.
 */

export type VitalSeverity = 'normal' | 'warning' | 'urgent' | 'unknown';

export type VitalMetricKey =
  | 'bp_systolic'
  | 'bp_diastolic'
  | 'heart_rate'
  | 'spo2'
  | 'temperature'
  | 'glucose'
  | string;

export type VitalMetricRule = {
  key: VitalMetricKey;
  label: string;
  unit: string;
  enabled: boolean;
  /** Inclusive normal band */
  normalMin: number | null;
  normalMax: number | null;
  /**
   * Wider warning band. Values between normal and these bounds are warning;
   * outside these bounds (when set) are urgent. If null, anything outside normal is urgent.
   */
  warningMin: number | null;
  warningMax: number | null;
  /** Built-in vs practice-added custom metric */
  isCustom?: boolean;
};

export type VitalMetricRulesConfig = {
  version: 1;
  metrics: VitalMetricRule[];
  updatedAt?: string;
};

export const DEFAULT_VITAL_METRIC_RULES: VitalMetricRule[] = [
  {
    key: 'bp_systolic',
    label: 'Blood pressure (systolic)',
    unit: 'mmHg',
    enabled: true,
    normalMin: 90,
    normalMax: 120,
    warningMin: 80,
    warningMax: 139,
  },
  {
    key: 'bp_diastolic',
    label: 'Blood pressure (diastolic)',
    unit: 'mmHg',
    enabled: true,
    normalMin: 60,
    normalMax: 80,
    warningMin: 50,
    warningMax: 89,
  },
  {
    key: 'heart_rate',
    label: 'Heart rate',
    unit: 'bpm',
    enabled: true,
    normalMin: 60,
    normalMax: 100,
    warningMin: 50,
    warningMax: 120,
  },
  {
    key: 'spo2',
    label: 'SpO2',
    unit: '%',
    enabled: true,
    normalMin: 95,
    normalMax: 100,
    warningMin: 90,
    warningMax: 100,
  },
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    enabled: true,
    normalMin: 36.1,
    normalMax: 37.2,
    warningMin: 35.5,
    warningMax: 38.0,
  },
  {
    key: 'glucose',
    label: 'Glucose',
    unit: 'mg/dL',
    enabled: true,
    normalMin: 70,
    normalMax: 140,
    warningMin: 54,
    warningMax: 180,
  },
];

export function defaultVitalRulesConfig(): VitalMetricRulesConfig {
  return {
    version: 1,
    metrics: DEFAULT_VITAL_METRIC_RULES.map((m) => ({ ...m })),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeVitalRulesConfig(
  raw: Partial<VitalMetricRulesConfig> | VitalMetricRule[] | null | undefined
): VitalMetricRulesConfig {
  const defaults = defaultVitalRulesConfig();
  if (!raw) return defaults;

  const incoming = Array.isArray(raw) ? raw : raw.metrics;
  if (!Array.isArray(incoming) || incoming.length === 0) return defaults;

  const byKey = new Map<string, VitalMetricRule>();
  for (const d of defaults.metrics) {
    byKey.set(d.key, { ...d });
  }
  for (const item of incoming) {
    if (!item || typeof item.key !== 'string') continue;
    const base = byKey.get(item.key);
    byKey.set(item.key, {
      key: item.key,
      label: String(item.label || base?.label || item.key),
      unit: String(item.unit || base?.unit || ''),
      enabled: item.enabled !== false,
      normalMin: toNumOrNull(item.normalMin),
      normalMax: toNumOrNull(item.normalMax),
      warningMin: toNumOrNull(item.warningMin),
      warningMax: toNumOrNull(item.warningMax),
      isCustom: Boolean(item.isCustom ?? base?.isCustom),
    });
  }

  return {
    version: 1,
    metrics: Array.from(byKey.values()),
    updatedAt:
      (!Array.isArray(raw) && raw.updatedAt) || new Date().toISOString(),
  };
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify a numeric reading against a rule.
 * - inside normal → normal
 * - outside normal but inside warning → warning
 * - outside warning (or outside normal when no warning band) → urgent
 */
export function evaluateMetricValue(
  rule: VitalMetricRule | undefined,
  value: number | null | undefined
): VitalSeverity {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (!rule || !rule.enabled) return 'unknown';

  const { normalMin, normalMax, warningMin, warningMax } = rule;
  const inNormal =
    (normalMin == null || value >= normalMin) &&
    (normalMax == null || value <= normalMax);
  if (inNormal) return 'normal';

  const hasWarningBand = warningMin != null || warningMax != null;
  if (!hasWarningBand) return 'urgent';

  const inWarning =
    (warningMin == null || value >= warningMin) &&
    (warningMax == null || value <= warningMax);
  return inWarning ? 'warning' : 'urgent';
}

export type VitalsReadingInput = {
  heartRate?: number | null;
  bloodPressure?: { systolic?: number | null; diastolic?: number | null } | null;
  temperature?: number | null;
  bloodSugar?: number | null;
  spo2?: number | null;
  /** Extra custom metric values keyed by rule key */
  extras?: Record<string, number | null | undefined>;
};

export type EvaluatedVital = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  displayValue: string;
  severity: VitalSeverity;
};

export function evaluateVitalsReading(
  reading: VitalsReadingInput,
  config: VitalMetricRulesConfig = defaultVitalRulesConfig()
): EvaluatedVital[] {
  const rules = config.metrics;
  const find = (key: string) => rules.find((r) => r.key === key);

  const results: EvaluatedVital[] = [];

  const push = (
    key: string,
    value: number | null | undefined,
    displayValue?: string
  ) => {
    const rule = find(key);
    if (!rule) return;
    const num = value == null || !Number.isFinite(Number(value)) ? null : Number(value);
    results.push({
      key,
      label: rule.label,
      unit: rule.unit,
      value: num,
      displayValue:
        displayValue ??
        (num == null ? '—' : Number.isInteger(num) ? String(num) : num.toFixed(1)),
      severity: evaluateMetricValue(rule, num),
    });
  };

  push('bp_systolic', reading.bloodPressure?.systolic);
  push('bp_diastolic', reading.bloodPressure?.diastolic);
  push('heart_rate', reading.heartRate);
  push('spo2', reading.spo2);
  push('temperature', reading.temperature);
  push('glucose', reading.bloodSugar);

  for (const rule of rules) {
    if (!rule.isCustom && !rule.key.startsWith('custom_')) continue;
    const v = reading.extras?.[rule.key];
    push(rule.key, v);
  }

  return results;
}

/** Worst severity across a reading (urgent > warning > normal > unknown) */
export function worstSeverity(severities: VitalSeverity[]): VitalSeverity {
  if (severities.includes('urgent')) return 'urgent';
  if (severities.includes('warning')) return 'warning';
  if (severities.includes('normal')) return 'normal';
  return 'unknown';
}

export function severityLabel(severity: VitalSeverity): string {
  switch (severity) {
    case 'normal':
      return 'Normal';
    case 'warning':
      return 'Warning';
    case 'urgent':
      return 'Urgent';
    default:
      return 'Unknown';
  }
}

export function createCustomMetricRule(
  label: string,
  unit: string,
  partial?: Partial<VitalMetricRule>
): VitalMetricRule {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'metric';
  return {
    key: `custom_${slug}_${Date.now().toString(36)}`,
    label: label.trim() || 'Custom metric',
    unit: unit.trim() || '',
    enabled: true,
    normalMin: partial?.normalMin ?? 0,
    normalMax: partial?.normalMax ?? 100,
    warningMin: partial?.warningMin ?? null,
    warningMax: partial?.warningMax ?? null,
    isCustom: true,
  };
}
