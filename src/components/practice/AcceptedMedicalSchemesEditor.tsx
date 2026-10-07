import React, { useEffect, useMemo, useState } from 'react';
import type { MedicalSchemeCatalogItem, MedicalSchemePlanCatalogItem } from '../../types';
import {
  djangoListMedicalSchemePlans,
  djangoListMedicalSchemes,
  djangoPutPracticeAcceptedSchemes,
} from '../../services/djangoApiService';

type Props = {
  practiceId: string;
  acceptsMedicalAid: boolean;
  initialSlugs: string[];
  initialPlanSlugs?: string[];
  disabled?: boolean;
  showSaveButton?: boolean;
  onSelectionChange?: (slugs: string[], planSlugs: string[]) => void;
  onSaved?: (slugs: string[], planSlugs: string[]) => void;
};

export const AcceptedMedicalSchemesEditor: React.FC<Props> = ({
  practiceId,
  acceptsMedicalAid,
  initialSlugs,
  initialPlanSlugs = [],
  disabled,
  showSaveButton = true,
  onSelectionChange,
  onSaved,
}) => {
  const [catalog, setCatalog] = useState<MedicalSchemeCatalogItem[]>([]);
  const [planCatalog, setPlanCatalog] = useState<MedicalSchemePlanCatalogItem[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSlugs);
  const [selectedPlans, setSelectedPlans] = useState<string[]>(initialPlanSlugs);
  const [showPlans, setShowPlans] = useState(initialPlanSlugs.length > 0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelected(initialSlugs);
  }, [initialSlugs.join('|')]);

  useEffect(() => {
    setSelectedPlans(initialPlanSlugs);
  }, [initialPlanSlugs.join('|')]);

  useEffect(() => {
    onSelectionChange?.(selected, selectedPlans);
  }, [selected, selectedPlans, onSelectionChange]);

  useEffect(() => {
    let cancelled = false;
    void djangoListMedicalSchemes()
      .then((rows) => {
        if (!cancelled) setCatalog(rows.filter((row) => row.slug !== 'other'));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load medical schemes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showPlans || selected.length === 0) {
      setPlanCatalog([]);
      return;
    }
    let cancelled = false;
    void Promise.all(selected.map((slug) => djangoListMedicalSchemePlans(slug)))
      .then((groups) => {
        if (!cancelled) setPlanCatalog(groups.flat());
      })
      .catch(() => {
        if (!cancelled) setError('Could not load plan options.');
      });
    return () => {
      cancelled = true;
    };
  }, [showPlans, selected.join('|')]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalog;
    return catalog.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.shortName.toLowerCase().includes(term) ||
        row.slug.includes(term),
    );
  }, [catalog, search]);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      setSelectedPlans((plans) =>
        plans.filter((planSlug) => {
          const plan = planCatalog.find((p) => p.slug === planSlug);
          return plan ? next.includes(plan.schemeSlug) : false;
        }),
      );
      return next;
    });
  };

  const togglePlan = (slug: string) => {
    setSelectedPlans((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleSave = async () => {
    if (disabled) return;
    setSaving(true);
    setError('');
    try {
      const result = await djangoPutPracticeAcceptedSchemes(
        practiceId,
        selected,
        showPlans ? selectedPlans : undefined,
      );
      onSaved?.(
        result.acceptedSchemes.map((row) => row.slug),
        result.acceptedPlans.map((row) => row.slug),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save schemes.');
    } finally {
      setSaving(false);
    }
  };

  if (!acceptsMedicalAid) {
    return (
      <p className="text-sm text-[#65758b]">
        This practice is marked as private / cash only. Turn on medical aid above to select schemes.
      </p>
    );
  }

  const showEmptyWarning = selected.length === 0;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-[#65758b]">
        Select every medical scheme warriors can use at this practice.
      </p>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search schemes…"
        disabled={disabled || loading}
        className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
      />
      {showEmptyWarning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Select at least one scheme warriors can use here.
        </p>
      ) : null}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-[#e1e7ef] p-2">
        {loading ? (
          <p className="px-2 py-3 text-sm text-[#65758b]">Loading schemes…</p>
        ) : (
          filtered.map((row) => (
            <label
              key={row.slug}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#344256] hover:bg-[#f6f8fa]"
            >
              <input
                type="checkbox"
                checked={selected.includes(row.slug)}
                disabled={disabled}
                onChange={() => toggle(row.slug)}
              />
              <span>{row.name}</span>
              {row.category === 'restricted' ? (
                <span className="text-[11px] text-[#8FA0B6]">(restricted)</span>
              ) : null}
            </label>
          ))
        )}
      </div>

      {selected.length > 0 ? (
        <div className="rounded-lg border border-[#e1e7ef] p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[#344256]">
            <input
              type="checkbox"
              checked={showPlans}
              disabled={disabled}
              onChange={(e) => setShowPlans(e.target.checked)}
            />
            Limit to specific plan options (optional)
          </label>
          <p className="mt-1 text-xs text-[#65758b]">
            Leave plans unchecked to accept all plans under the selected schemes.
          </p>
          {showPlans ? (
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {planCatalog.map((plan) => (
                <label
                  key={plan.slug}
                  className="flex cursor-pointer items-center gap-2 text-sm text-[#344256]"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlans.includes(plan.slug)}
                    disabled={disabled}
                    onChange={() => togglePlan(plan.slug)}
                  />
                  <span>
                    {plan.name}{' '}
                    <span className="text-[11px] text-[#8FA0B6]">({plan.schemeName})</span>
                  </span>
                </label>
              ))}
              {planCatalog.length === 0 ? (
                <p className="text-sm text-[#65758b]">Loading plans…</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {showSaveButton ? (
        <button
          type="button"
          disabled={disabled || saving || loading}
          onClick={() => void handleSave()}
          className="rounded-lg bg-anixi-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save accepted schemes'}
        </button>
      ) : null}
    </div>
  );
};
