import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  defaultAdherenceRules,
  type AdherenceRulesConfig,
} from '../lib/adherenceEventModel';
import {
  loadAdherenceRules,
  resetAdherenceRules,
  saveAdherenceRules,
  setAdherenceRulesPracticeContext,
} from '../services/adherenceRulesService';

export function useAdherenceRules() {
  const { practiceSession } = useAuth();
  const practiceId = practiceSession?.practice?.id;
  const overlay = (
    practiceSession?.practice as { adherenceRules?: Partial<AdherenceRulesConfig> } | undefined
  )?.adherenceRules;

  const [config, setConfig] = useState<AdherenceRulesConfig>(() =>
    loadAdherenceRules(practiceId, overlay)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAdherenceRulesPracticeContext(practiceId);
    setConfig(loadAdherenceRules(practiceId, overlay));
  }, [practiceId, overlay]);

  const save = useCallback(
    (next: AdherenceRulesConfig) => {
      if (!practiceId) {
        const local = { ...next, version: 1 as const, updatedAt: new Date().toISOString() };
        setConfig(local);
        return local;
      }
      setSaving(true);
      try {
        const saved = saveAdherenceRules(practiceId, next);
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
      const d = defaultAdherenceRules();
      setConfig(d);
      return d;
    }
    const d = resetAdherenceRules(practiceId);
    setConfig(d);
    return d;
  }, [practiceId]);

  return { config, save, reset, saving, practiceId };
}
