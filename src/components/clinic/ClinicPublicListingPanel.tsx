import React, { useEffect, useState } from 'react';
import { Globe2, Loader2, MapPin, Sparkles } from 'lucide-react';
import type { Practice, PublicClinicListingSettings } from '../../types';
import { SA_PROVINCES } from '../../lib/southAfrica';
import { updatePractice } from '../../services/practiceSettingsService';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-[#e1e7ef] bg-white px-3.5 py-2.5 text-sm text-[#344256] placeholder:text-[#94a3b8] transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/15';
const labelClass = 'block text-sm font-medium text-[#344256]';
const hintClass = 'mt-1 text-xs text-[#65758b]';

type ListingDraft = {
  published: boolean;
  tagline: string;
  description: string;
  city: string;
  province: string;
};

type Props = {
  practice: Practice;
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
  onToast: (message: string, type: 'success' | 'error') => void;
  onOpenMedicalAid?: () => void;
};

function draftFromPractice(practice: Practice): ListingDraft {
  const listing: PublicClinicListingSettings = practice.publicListing ?? { published: false };
  return {
    published: listing.published === true,
    tagline: listing.tagline?.trim() ?? '',
    description: listing.description?.trim() ?? '',
    city: listing.city?.trim() ?? '',
    province: listing.province?.trim() ?? '',
  };
}

export const ClinicPublicListingPanel: React.FC<Props> = ({
  practice,
  canEdit,
  onSaved,
  onToast,
  onOpenMedicalAid,
}) => {
  const [draft, setDraft] = useState<ListingDraft>(() => draftFromPractice(practice));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftFromPractice(practice));
  }, [practice]);

  const handleSave = async () => {
    if (!canEdit) return;
    if (draft.published && !draft.tagline.trim()) {
      onToast('Add a short tagline before publishing on the marketplace.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updatePractice(practice.id, {
        publicListing: {
          ...(practice.publicListing ?? {}),
          published: draft.published,
          slug: practice.publicListing?.slug || practice.id,
          tagline: draft.tagline.trim() || undefined,
          description: draft.description.trim() || undefined,
          city: draft.city.trim() || undefined,
          province: draft.province.trim() || undefined,
        },
      });

      await onSaved();
      onToast('Marketplace profile saved.', 'success');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Could not save marketplace profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = draft.published
    ? 'Visible on the Anixi marketplace'
    : 'Not published — only your team sees this clinic';

  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 ${
          draft.published
            ? 'border-emerald-200 bg-emerald-50/80'
            : 'border-[#e1e7ef] bg-[#fafcfb]'
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              draft.published ? 'bg-emerald-600 text-white' : 'bg-[#e8eeec] text-[#65758b]'
            }`}
          >
            <Globe2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#0E2340]">Marketplace visibility</p>
            <p className="mt-0.5 text-[13px] text-[#65758b]">{statusLabel}</p>
          </div>
        </div>
        {canEdit ? (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 sm:mt-0">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#c5ced9] text-anixi-green focus:ring-anixi-green"
              checked={draft.published}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, published: e.target.checked }))
              }
            />
            <span className="text-sm font-medium text-[#344256]">Publish on marketplace</span>
          </label>
        ) : (
          <p className="mt-2 text-sm text-[#65758b] sm:mt-0">
            {practice.publicListing?.published ? 'Published' : 'Draft'}
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-anixi-green" strokeWidth={1.75} aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-[#0E2340]">How Patients find you</h2>
            <p className="text-[13px] text-[#65758b]">
              Shown in the patient app when they browse clinics and book care.
            </p>
          </div>
        </div>

        {canEdit ? (
          <div className="space-y-5">
            <div>
              <label className={labelClass} htmlFor="clinic-listing-tagline">
                Tagline
              </label>
              <p className={hintClass}>One line that captures what makes your clinic special.</p>
              <input
                id="clinic-listing-tagline"
                value={draft.tagline}
                onChange={(e) => setDraft((prev) => ({ ...prev, tagline: e.target.value }))}
                placeholder="e.g. Family medicine in the heart of Sandton"
                className={fieldClass}
                maxLength={120}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="clinic-listing-description">
                About your clinic
              </label>
              <p className={hintClass}>Services, languages, and what patients should expect.</p>
              <textarea
                id="clinic-listing-description"
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe your team, specialties, and visit options…"
                rows={4}
                className={fieldClass}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="clinic-listing-city">
                  City
                </label>
                <input
                  id="clinic-listing-city"
                  value={draft.city}
                  onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Johannesburg"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="clinic-listing-province">
                  Province
                </label>
                <select
                  id="clinic-listing-province"
                  value={draft.province}
                  onChange={(e) => setDraft((prev) => ({ ...prev, province: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="">Select province</option>
                  {SA_PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-[#344256]">
            {draft.tagline ? <p className="font-medium">{draft.tagline}</p> : null}
            {draft.description ? <p className="text-[#65758b]">{draft.description}</p> : null}
            {(draft.city || draft.province) && (
              <p className="inline-flex items-center gap-1.5 text-[#65758b]">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {[draft.city, draft.province].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}
      </section>

      {canEdit ? (
        <div className="flex flex-col gap-3 border-t border-[#eef2f6] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#65758b]"></p>
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
              'Save marketplace profile'
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
};
