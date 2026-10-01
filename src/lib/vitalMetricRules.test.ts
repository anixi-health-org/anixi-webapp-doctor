import {
  defaultVitalRulesConfig,
  evaluateMetricValue,
  evaluateVitalsReading,
  normalizeVitalRulesConfig,
  worstSeverity,
} from './vitalMetricRules';

describe('vitalMetricRules', () => {
  const config = defaultVitalRulesConfig();

  it('classifies heart rate bands', () => {
    const hr = config.metrics.find((m) => m.key === 'heart_rate');
    expect(hr).toBeTruthy();
    if (!hr) return;
    expect(evaluateMetricValue(hr, 72)).toBe('normal');
    expect(evaluateMetricValue(hr, 110)).toBe('warning');
    expect(evaluateMetricValue(hr, 45)).toBe('urgent');
    expect(evaluateMetricValue(hr, 130)).toBe('urgent');
  });

  it('classifies SpO2', () => {
    const spo2 = config.metrics.find((m) => m.key === 'spo2');
    expect(spo2).toBeTruthy();
    if (!spo2) return;
    expect(evaluateMetricValue(spo2, 97)).toBe('normal');
    expect(evaluateMetricValue(spo2, 92)).toBe('warning');
    expect(evaluateMetricValue(spo2, 88)).toBe('urgent');
  });

  it('evaluates a full reading and picks worst severity', () => {
    const evaluated = evaluateVitalsReading(
      {
        heartRate: 72,
        bloodPressure: { systolic: 150, diastolic: 95 },
        temperature: 36.8,
        bloodSugar: 110,
        spo2: 96,
      },
      config
    );
    expect(evaluated.find((e) => e.key === 'bp_systolic')?.severity).toBe('urgent');
    expect(worstSeverity(evaluated.map((e) => e.severity))).toBe('urgent');
  });

  it('merges custom metrics when normalizing', () => {
    const merged = normalizeVitalRulesConfig({
      version: 1,
      metrics: [
        {
          key: 'heart_rate',
          label: 'HR',
          unit: 'bpm',
          enabled: true,
          normalMin: 55,
          normalMax: 95,
          warningMin: 45,
          warningMax: 110,
        },
        {
          key: 'custom_rr',
          label: 'Respiratory rate',
          unit: '/min',
          enabled: true,
          normalMin: 12,
          normalMax: 20,
          warningMin: 8,
          warningMax: 24,
          isCustom: true,
        },
      ],
    });
    expect(merged.metrics.find((m) => m.key === 'heart_rate')?.normalMin).toBe(55);
    expect(merged.metrics.find((m) => m.key === 'spo2')).toBeTruthy();
    expect(merged.metrics.find((m) => m.key === 'custom_rr')?.label).toBe(
      'Respiratory rate'
    );
  });
});
