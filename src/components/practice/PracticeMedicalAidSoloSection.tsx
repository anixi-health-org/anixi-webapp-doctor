import React, { useEffect, useRef, useState } from 'react';
import type { Practice } from '../../types';
import { djangoPutPracticeAcceptedSchemes } from '../../services/djangoApiService';
import { provisionPracticeForDoctor, updatePractice } from '../../services/practiceSettingsService';
import { AcceptedMedicalSchemesEditor } from './AcceptedMedicalSchemesEditor';

type Props = {
  doctorId: string;
  practice: Practice | null | undefined;
  practiceNameFallback: string;
  onPracticeReady: () => Promise<void>;
};

/** Solo doctor onboarding — provisions a practice if needed, then configures accepted schemes. */
export const PracticeMedicalAidSoloSection: React.FC<Props> = ({
  doctorId,
  practice,
  practiceNameFallback,
  onPracticeReady,
}) => {
  const provisionAttempted = useRef(false);
  const [localPractice, setLocalPractice] = useState<Practice | null | undefined>(practice);
  const [provisioning, setProvisioning] = useState(false);
  const [acceptsMedicalAid, setAcceptsMedicalAid] = useState(
    practice?.publicListing?.acceptsMedicalAid ?? true,
  );
  const [schemeSlugs, setSchemeSlugs] = useState<string[]>(
    (practice?.acceptedSchemes ?? []).map((row) => row.slug),
  );
  const [planSlugs, setPlanSlugs] = useState<string[]>(
    (practice?.acceptedPlans ?? []).map((row) => row.slug),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocalPractice(practice);
    setAcceptsMedicalAid(practice?.publicListing?.acceptsMedicalAid ?? true);
    setSchemeSlugs((practice?.acceptedSchemes ?? []).map((row) => row.slug));
    setPlanSlugs((practice?.acceptedPlans ?? []).map((row) => row.slug));
  }, [practice?.id, practice?.publicListing?.acceptsMedicalAid, practice?.acceptedSchemes, practice?.acceptedPlans]);

  useEffect(() => {
    if (localPractice?.id || provisionAttempted.current) return;
    provisionAttempted.current = true;
    setProvisioning(true);
    void provisionPracticeForDoctor(doctorId, {
      name: practiceNameFallback.trim() || 'My practice',
      orgType: 'solo',
    })
      .then(async (bundle) => {
        setLocalPractice(bundle.practice);
        await onPracticeReady();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not create your practice.');
        provisionAttempted.current = false;
      })
      .finally(() => setProvisioning(false));
  }, [doctorId, localPractice?.id, onPracticeReady, practiceNameFallback]);

  const handleSave = async () => {
    const activePractice = localPractice;
    if (!activePractice?.id) {
      setError('Practice is still being created. Try again in a moment.');
      return;
    }
    if (acceptsMedicalAid && schemeSlugs.length === 0) {
      setError('Select at least one medical scheme you accept.');
      return;
    }
    setError('');
    try {
      await updatePractice(activePractice.id, {
        publicListing: {
          ...(activePractice.publicListing ?? {}),
          published: activePractice.publicListing?.published ?? false,
          slug: activePractice.publicListing?.slug || activePractice.id,
          acceptsMedicalAid,
        },
      });
      if (acceptsMedicalAid) {
        await djangoPutPracticeAcceptedSchemes(activePractice.id, schemeSlugs, planSlugs);
      } else {
        await djangoPutPracticeAcceptedSchemes(activePractice.id, [], []);
      }
      setSaved(true);
      await onPracticeReady();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save medical aid settings.');
    }
  };

  if (provisioning || !localPractice?.id) {
    return (
      <div className="md:col-span-2 rounded-xl border border-[#eef2f6] bg-[#fafcfb] px-4 py-4 text-sm text-[#65758b]">
        Preparing your practice for medical aid settings…
      </div>
    );
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-xl border border-[#eef2f6] bg-[#fafcfb] p-4">
      <div>
        <p className="text-sm font-semibold text-[#344256]">Medical aid schemes you accept</p>
        <p className="mt-1 text-xs text-[#65758b]">
          Warriors use this to see if their plan matches your practice. You can change this later in
          Settings.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#344256]">
        <input
          type="checkbox"
          checked={acceptsMedicalAid}
          onChange={(e) => {
            setSaved(false);
            setAcceptsMedicalAid(e.target.checked);
          }}
        />
        I accept medical aid
      </label>
      <AcceptedMedicalSchemesEditor
        practiceId={localPractice.id}
        acceptsMedicalAid={acceptsMedicalAid}
        initialSlugs={schemeSlugs}
        initialPlanSlugs={planSlugs}
        showSaveButton={false}
        onSelectionChange={(slugs, plans) => {
          setSaved(false);
          setSchemeSlugs(slugs);
          setPlanSlugs(plans);
        }}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? (
        <p className="text-sm font-medium text-anixi-green">Medical aid settings saved.</p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleSave()}
        className="rounded-lg border border-[#e1e7ef] bg-white px-4 py-2 text-sm font-semibold text-[#344256] hover:bg-[#f6f8fa]"
      >
        Save medical aid schemes
      </button>
    </div>
  );
};
