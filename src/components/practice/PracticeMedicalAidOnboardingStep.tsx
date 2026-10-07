import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Practice } from '../../types';
import { djangoPutPracticeAcceptedSchemes } from '../../services/djangoApiService';
import { updatePractice } from '../../services/practiceSettingsService';
import { AcceptedMedicalSchemesEditor } from './AcceptedMedicalSchemesEditor';

type Props = {
  practice: Practice;
  onContinue: () => void;
  onRefreshPractice?: () => Promise<void>;
};

export const PracticeMedicalAidOnboardingStep: React.FC<Props> = ({
  practice,
  onContinue,
  onRefreshPractice,
}) => {
  const [acceptsMedicalAid, setAcceptsMedicalAid] = useState(
    practice.publicListing?.acceptsMedicalAid ?? true,
  );
  const [schemeSlugs, setSchemeSlugs] = useState<string[]>(
    (practice.acceptedSchemes ?? []).map((row) => row.slug),
  );
  const [planSlugs, setPlanSlugs] = useState<string[]>(
    (practice.acceptedPlans ?? []).map((row) => row.slug),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAcceptsMedicalAid(practice.publicListing?.acceptsMedicalAid ?? true);
    setSchemeSlugs((practice.acceptedSchemes ?? []).map((row) => row.slug));
    setPlanSlugs((practice.acceptedPlans ?? []).map((row) => row.slug));
  }, [practice.id, practice.publicListing?.acceptsMedicalAid, practice.acceptedSchemes, practice.acceptedPlans]);

  const handleContinue = async () => {
    setError('');
    if (acceptsMedicalAid && schemeSlugs.length === 0) {
      setError('Select at least one medical scheme your clinic accepts.');
      return;
    }

    setSaving(true);
    try {
      await updatePractice(practice.id, {
        publicListing: {
          ...(practice.publicListing ?? {}),
          published: practice.publicListing?.published ?? false,
          slug: practice.publicListing?.slug || practice.id,
          acceptsMedicalAid,
        },
      });

      if (acceptsMedicalAid) {
        await djangoPutPracticeAcceptedSchemes(practice.id, schemeSlugs, planSlugs);
      } else {
        await djangoPutPracticeAcceptedSchemes(practice.id, [], []);
      }

      await onRefreshPractice?.();
      onContinue();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save medical aid settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
        <div className="border-b border-[#eef2f6] bg-[#fafcfb] px-5 py-4 sm:px-6">
          <p className="text-sm font-semibold text-[#344256]">Medical aid schemes</p>
          <p className="mt-1 text-xs text-[#65758b]">
            Warriors and doctors at your clinic use this list for booking and claims. Individual
            doctors inherit these schemes automatically.
          </p>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <label className="flex items-center gap-2 text-sm text-[#344256]">
            <input
              type="checkbox"
              checked={acceptsMedicalAid}
              onChange={(e) => setAcceptsMedicalAid(e.target.checked)}
            />
            This clinic accepts medical aid
          </label>

          <AcceptedMedicalSchemesEditor
            practiceId={practice.id}
            acceptsMedicalAid={acceptsMedicalAid}
            initialSlugs={schemeSlugs}
            initialPlanSlugs={planSlugs}
            showSaveButton={false}
            onSelectionChange={(slugs, plans) => {
              setSchemeSlugs(slugs);
              setPlanSlugs(plans);
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleContinue()}
          className="flex items-center justify-center gap-2 rounded-full bg-anixi-green px-8 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            'Save & invite doctors'
          )}
        </button>
      </div>
    </div>
  );
};
