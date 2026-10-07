import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HeartPulse, Loader2, Plus, X } from 'lucide-react';
import type { MedicalSchemeCatalogItem, Practice } from '../../types';
import {
  djangoListMedicalSchemes,
  djangoPutPracticeAcceptedSchemes,
} from '../../services/djangoApiService';
import { updatePractice } from '../../services/practiceSettingsService';

type Props = {
  practice: Practice;
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
  onToast: (message: string, type: 'success' | 'error') => void;
};

export const ClinicMedicalAidPanel: React.FC<Props> = ({
  practice,
  canEdit,
  onSaved,
  onToast,
}) => {
  const [acceptsMedicalAid, setAcceptsMedicalAid] = useState(
    practice.publicListing?.acceptsMedicalAid === true,
  );
  const [schemeSlugs, setSchemeSlugs] = useState<string[]>(
    () => (practice.acceptedSchemes ?? []).map((row) => row.slug),
  );
  const [catalog, setCatalog] = useState<MedicalSchemeCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [pickerValue, setPickerValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAcceptsMedicalAid(practice.publicListing?.acceptsMedicalAid === true);
    setSchemeSlugs((practice.acceptedSchemes ?? []).map((row) => row.slug));
  }, [practice.id, practice.publicListing?.acceptsMedicalAid, practice.acceptedSchemes]);

  useEffect(() => {
    let cancelled = false;
    void djangoListMedicalSchemes()
      .then((rows) => {
        if (!cancelled) {
          setCatalog(rows.filter((row) => row.slug !== 'other'));
        }
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogBySlug = useMemo(() => {
    const map = new Map<string, MedicalSchemeCatalogItem>();
    for (const row of catalog) {
      map.set(row.slug, row);
    }
    for (const row of practice.acceptedSchemes ?? []) {
      if (!map.has(row.slug)) map.set(row.slug, row);
    }
    return map;
  }, [catalog, practice.acceptedSchemes]);

  const selectedSchemes = useMemo(
    () =>
      schemeSlugs
        .map((slug) => catalogBySlug.get(slug))
        .filter((row): row is MedicalSchemeCatalogItem => Boolean(row)),
    [schemeSlugs, catalogBySlug],
  );

  const availableToAdd = useMemo(
    () =>
      catalog
        .filter((row) => !schemeSlugs.includes(row.slug))
        .sort((a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name)),
    [catalog, schemeSlugs],
  );

  const addScheme = (slug: string) => {
    if (!slug || schemeSlugs.includes(slug)) return;
    setSchemeSlugs((prev) => [...prev, slug]);
    setPickerValue('');
  };

  const removeScheme = (slug: string) => {
    setSchemeSlugs((prev) => prev.filter((s) => s !== slug));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (acceptsMedicalAid && schemeSlugs.length === 0) {
      onToast('Add at least one medical scheme, or turn off medical aid.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updatePractice(practice.id, {
        publicListing: {
          ...(practice.publicListing ?? { published: false }),
          published: practice.publicListing?.published ?? false,
          slug: practice.publicListing?.slug || practice.id,
          acceptsMedicalAid,
        },
      });

      if (acceptsMedicalAid) {
        await djangoPutPracticeAcceptedSchemes(practice.id, schemeSlugs);
      } else {
        await djangoPutPracticeAcceptedSchemes(practice.id, [], []);
      }

      await onSaved();
      onToast('Medical aid settings saved.', 'success');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Could not save medical aid settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const displayName = (row: MedicalSchemeCatalogItem) =>
    row.shortName?.trim() || row.name?.trim() || row.slug;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-anixi-green/10 text-anixi-green">
            <HeartPulse className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#0E2340]">Medical aid at your clinic</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#65758b]">
              Warriors see these schemes when booking. Every doctor on your team uses the same
              list — you set it once here.
            </p>
          </div>
        </div>

        {canEdit ? (
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#eef2f6] bg-[#fafcfb] px-4 py-3.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[#c5ced9] text-anixi-green focus:ring-anixi-green"
              checked={acceptsMedicalAid}
              onChange={(e) => setAcceptsMedicalAid(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-[#344256]">
                We accept medical aid
              </span>
              <span className="mt-0.5 block text-xs text-[#65758b]">
                Turn off if patients pay cash or privately only.
              </span>
            </span>
          </label>
        ) : (
          <p className="mt-5 text-sm font-medium text-[#344256]">
            {acceptsMedicalAid ? 'Medical aid accepted' : 'Cash / private pay only'}
          </p>
        )}
      </div>

      {acceptsMedicalAid ? (
        <>
          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-[#0E2340]">Accepted schemes</h3>
              <span className="text-sm font-medium text-anixi-green">
                {selectedSchemes.length} selected
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#65758b]">
              These are the schemes your clinic currently accepts.
            </p>

            <div className="mt-4 min-h-[4.5rem] rounded-xl border border-[#e8eeec] bg-[#fafcfb] p-4">
              {selectedSchemes.length === 0 ? (
                <p className="text-center text-sm text-[#94a3b8]">
                  No schemes yet — add one below.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {selectedSchemes.map((row) => (
                    <li key={row.slug}>
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-anixi-green/30 bg-anixi-green/10 py-1.5 pl-3 pr-1.5 text-sm font-medium text-[#1a3d32]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-anixi-green" aria-hidden />
                        <span className="truncate">{displayName(row)}</span>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => removeScheme(row.slug)}
                            className="rounded-full p-0.5 text-[#65758b] hover:bg-white hover:text-red-600"
                            aria-label={`Remove ${displayName(row)}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canEdit ? (
              <div className="mt-5">
                <label htmlFor="clinic-scheme-picker" className="block text-sm font-medium text-[#344256]">
                  Add a scheme
                </label>
                <p className="mt-0.5 text-xs text-[#65758b]">
                  Choose from South African medical schemes. You can add as many as apply to your
                  clinic.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    id="clinic-scheme-picker"
                    value={pickerValue}
                    disabled={catalogLoading || availableToAdd.length === 0}
                    onChange={(e) => {
                      const slug = e.target.value;
                      if (slug) addScheme(slug);
                    }}
                    className="min-w-0 flex-1 rounded-xl border border-[#e1e7ef] bg-white px-3.5 py-2.5 text-sm text-[#344256] focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/15 disabled:opacity-60"
                  >
                    <option value="">
                      {catalogLoading
                        ? 'Loading schemes…'
                        : availableToAdd.length === 0
                          ? 'All available schemes are already selected'
                          : 'Select a scheme to add…'}
                    </option>
                    {availableToAdd.map((row) => (
                      <option key={row.slug} value={row.slug}>
                        {displayName(row)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!pickerValue || catalogLoading}
                    onClick={() => addScheme(pickerValue)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e1e7ef] bg-white px-4 py-2.5 text-sm font-semibold text-[#344256] hover:bg-[#f6f8fa] disabled:opacity-50 sm:w-auto"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {canEdit ? (
            <div className="flex flex-col gap-3 border-t border-[#eef2f6] pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#65758b]">
                Saving updates the patient app, marketplace, and all employed doctors.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-anixi-green px-8 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Save medical aid schemes'
                )}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d1ddd8] bg-[#fafcfb] px-5 py-8 text-center">
          <p className="text-sm text-[#65758b]">
            Medical aid is off. Turn it on above to choose which schemes your clinic accepts.
          </p>
          {canEdit ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="mt-4 rounded-full border border-[#e1e7ef] bg-white px-6 py-2.5 text-sm font-semibold text-[#344256] hover:bg-[#f6f8fa] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save (cash only)'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
