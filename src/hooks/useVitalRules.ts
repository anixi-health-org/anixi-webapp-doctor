import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  defaultVitalRulesConfig,
  type VitalMetricRulesConfig,
} from '../lib/vitalMetricRules';
import {
  loadVitalRules,
  resetVitalRules,
  saveVitalRules,
} from '../services/vitalRulesService';

export function useVitalRules() {
  const { practiceSession } = useAuth();
  const practiceId = practiceSession?.practice?.id;
  const overlay = (practiceSession?.practice as { vitalMetricRules?: VitalMetricRulesConfig } | undefined)
    ?.vitalMetricRules;

  const [config, setConfig] = useState<VitalMetricRulesConfig>(() =>
    loadVitalRules(practiceId, overlay)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(loadVitalRules(practiceId, overlay));
  }, [practiceId, overlay]);

  const save = useCallback(
    (next: VitalMetricRulesConfig) => {
      if (!practiceId) {
        setConfig(normalizeLocal(next));
        return normalizeLocal(next);
      }
      setSaving(true);
      try {
        const saved = saveVitalRules(practiceId, next);
        setConfig(saved);
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [practiceId]
  );

  const reset = useCallback(() => {
    if (!practiceId) {
      const d = defaultVitalRulesConfig();
      setConfig(d);
      return d;
    }
    const d = resetVitalRules(practiceId);
    setConfig(d);
    return d;
  }, [practiceId]);

  return { config, save, reset, saving, practiceId };
}

function normalizeLocal(next: VitalMetricRulesConfig): VitalMetricRulesConfig {
  return {
    ...next,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}
