import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2, MapPin, Rocket } from 'lucide-react';
import { BulkDoctorInvitePanel } from '../components/onboarding/BulkDoctorInvitePanel';
import { BulkPatientImportPanel } from '../components/onboarding/BulkPatientImportPanel';
import { OnboardingShell } from '../components/onboarding/OnboardingShell';
import { getOnboardingStepMeta } from '../components/onboarding/OnboardingProgress';
import { AppShellSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/AuthContext';
import { detectBrowserTimezone, PRACTICE_TIMEZONES } from '../lib/timezones';
import { notifyPendingInvitesClinicLive } from '../services/practiceInviteService';
import {
  djangoPatchDoctorProfile,
  markClinicOnboardingComplete,
} from '../services/djangoApiService';
import {
  createPractice,
  ensureBookingPolicy,
  ensureOwnerMembership,
  updatePractice,
} from '../services/practiceSettingsService';
import type { Doctor, PracticeLocation } from '../types';

const fieldClass =
  'w-full rounded-xl border border-[#e1e7ef] bg-white px-3.5 py-2.5 text-sm text-[#344256] placeholder:text-[#94a3b8] transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/15';
const labelClass = 'mb-1.5 block text-sm font-medium text-[#344256]';

type ClinicStep = 1 | 2 | 3 | 4;

const STEP_FROM_ID: Record<string, ClinicStep> = {
  clinic: 1,
  team: 2,
  patients: 3,
  launch: 4,
};

export const ClinicSetupPage: React.FC = () => {
  const {
    user,
    practiceSession,
    clinicOnboardingComplete,
    refreshPracticeSession,
    refreshUser,
  } = useAuth();
  const navigate = useNavigate();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const existingPractice =
    practiceSession?.practice && practiceSession.practice.ownerId === doctor?.id
      ? practiceSession.practice
      : null;

  const [name, setName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [timezone, setTimezone] = useState(() => {
    const detected = detectBrowserTimezone();
    return detected === 'UTC' ? 'Africa/Johannesburg' : detected;
  });
  const [locationName, setLocationName] = useState('Main Clinic');
  const [locationAddress, setLocationAddress] = useState('');
  const [bhfPracticeNumber, setBhfPracticeNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<ClinicStep>(1);
  const [hasInitialised, setHasInitialised] = useState(false);

  const timezoneOptions = useMemo(() => {
    const values = new Set(PRACTICE_TIMEZONES.map((t) => t.value));
    if (!values.has(timezone)) {
      return [{ value: timezone, label: timezone }, ...PRACTICE_TIMEZONES];
    }
    return PRACTICE_TIMEZONES;
  }, [timezone]);

  useEffect(() => {
    if (hasInitialised || !doctor) return;
    if (existingPractice) {
      setName(existingPractice.name);
      setTradingName(existingPractice.tradingName || '');
      setTimezone(existingPractice.timezone);
      setBhfPracticeNumber(existingPractice.bhfPracticeNumber || '');
      const firstLocation = existingPractice.locations?.[0];
      if (firstLocation) {
        setLocationName(firstLocation.name);
        setLocationAddress(firstLocation.address || '');
      }
      if (!clinicOnboardingComplete) {
        setStep(2);
      } else {
        setStep(4);
      }
    }
    setHasInitialised(true);
  }, [existingPractice, doctor, hasInitialised, clinicOnboardingComplete]);

  const stepMeta = getOnboardingStepMeta('clinic', step);
  const isEditing = step === 1 && Boolean(existingPractice);
  const practiceId = existingPractice?.id;

  if (!doctor || !hasInitialised) {
    return <AppShellSkeleton />;
  }

  const goToStep = (target: ClinicStep) => {
    if (target > 1 && !practiceId) return;
    setStep(target);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Clinic name is required');
      return;
    }

    setSaving(true);
    try {
      const location: PracticeLocation = {
        id: existingPractice?.locations?.[0]?.id || `loc_${Date.now().toString(36)}`,
        name: locationName.trim() || 'Main Clinic',
        address: locationAddress.trim() || undefined,
        type: 'clinic',
      };

      if (existingPractice) {
        await updatePractice(existingPractice.id, {
          name: name.trim(),
          timezone,
          tradingName: tradingName.trim() || undefined,
          bhfPracticeNumber: bhfPracticeNumber.trim() || undefined,
          locations: [location, ...(existingPractice.locations?.slice(1) || [])],
        });
        await ensureOwnerMembership(existingPractice.id, doctor.id, {
          isClinician: false,
        });
        await djangoPatchDoctorProfile({ application_complete: false });
        await refreshPracticeSession();
        setStep(2);
        return;
      }

      const newPracticeId = await createPractice(doctor.id, {
        name: name.trim(),
        timezone,
        orgType: 'clinic',
        tradingName: tradingName.trim() || undefined,
        bhfPracticeNumber: bhfPracticeNumber.trim() || undefined,
        locations: [location],
        consultTypes: ['initial', 'follow-up', 'urgent', 'teleconsult'],
      });

      await ensureOwnerMembership(newPracticeId, doctor.id, {
        isClinician: false,
      });
      await ensureBookingPolicy(newPracticeId);
      await djangoPatchDoctorProfile({ application_complete: false });

      await refreshPracticeSession();
      await refreshUser();
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save clinic details');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async () => {
    if (!doctor) return;
    setSaving(true);
    try {
      if (practiceId) {
        await notifyPendingInvitesClinicLive(
          practiceId,
          name || existingPractice?.name || 'Your clinic'
        );
      }
      await markClinicOnboardingComplete(doctor.id);
      await refreshUser();
      navigate('/clinic', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not finish setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      flow="clinic"
      currentStep={step}
      title={isEditing ? 'Edit clinic details' : stepMeta.title}
      subtitle={isEditing ? 'Update your clinic information.' : stepMeta.subtitle}
      maxWidth="full"
      onBack={
        step > 1
          ? () => goToStep((step - 1) as ClinicStep)
          : undefined
      }
      backLabel={
        step === 2
          ? 'Back to clinic details'
          : step === 3
            ? 'Back to invite doctors'
            : step === 4
              ? 'Back to import patients'
              : 'Back'
      }
      onStepClick={(clickedStep, stepNumber) => {
        if (stepNumber < step) {
          const target = STEP_FROM_ID[clickedStep.id];
          if (target) goToStep(target);
        }
      }}
    >
      {step === 1 && (
        <form
          onSubmit={handleCreate}
          className="max-w-3xl overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm"
        >
          <div className="border-b border-[#eef2f6] bg-[#fafcfb] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-anixi-green/10 text-anixi-green">
                <Building2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#344256]">Clinic identity</p>
                <p className="text-xs text-[#65758b]">Name, timezone, and first location</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Clinic name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Sandton Family Clinic"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Trading name{' '}
                  <span className="font-normal text-[#94a3b8]">(optional)</span>
                </label>
                <input
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  className={fieldClass}
                  placeholder="If different from clinic name"
                />
              </div>
              <div>
                <label className={labelClass}>Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={fieldClass}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  BHF practice no.{' '}
                  <span className="font-normal text-[#94a3b8]">(optional)</span>
                </label>
                <input
                  value={bhfPracticeNumber}
                  onChange={(e) => setBhfPracticeNumber(e.target.value)}
                  className={fieldClass}
                  placeholder="Practice number"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#eef2f6] bg-[#fafcfb] p-4">
              <div className="mb-4 flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-anixi-green" strokeWidth={1.75} />
                <p className="text-sm font-semibold text-[#344256]">First location</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Location name</label>
                  <input
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Address{' '}
                    <span className="font-normal text-[#94a3b8]">(optional)</span>
                  </label>
                  <input
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    className={fieldClass}
                    placeholder="Street, suburb, city"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-[#eef2f6] bg-[#fafcfb] px-5 py-4 sm:px-6">
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-anixi-green py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : isEditing ? (
                'Save & continue'
              ) : (
                'Create clinic & continue'
              )}
            </button>
          </div>
        </form>
      )}

      {step === 2 && practiceId && (
        <div className="max-w-3xl space-y-4">
          <BulkDoctorInvitePanel
            practiceId={practiceId}
            practiceName={name || existingPractice?.name || 'Your clinic'}
            invitedBy={doctor.id}
            invitedByName={doctor.displayName}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-full bg-anixi-green px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Continue to patients
            </button>
          </div>
        </div>
      )}

      {step === 3 && practiceId && (
        <div className="max-w-3xl space-y-4">
          <BulkPatientImportPanel
            doctorId={doctor.id}
            practiceId={practiceId}
            practiceName={name || existingPractice?.name}
            clinicCode={existingPractice?.clinicCode}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-full border border-[#e1e7ef] px-6 py-3 text-sm font-semibold text-[#344256] hover:bg-white"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-full bg-anixi-green px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="max-w-3xl space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-5 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
            <div>
              <p className="font-semibold text-emerald-900">
                {name || existingPractice?.name || 'Your clinic'} is ready to go live
              </p>
              <p className="mt-1 text-sm text-emerald-800/90">
                Doctors you invited will create their own logins and complete their profiles.
                Patients with email addresses receive app download links.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e1e7ef] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-anixi-green/10 text-anixi-green">
                <Rocket className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-semibold text-[#344256]">Open your clinic admin portal</p>
                <p className="text-sm text-[#65758b]">
                  Manage team, patients, and bookings from your clinic administration dashboard.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleLaunch()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-anixi-green py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-10"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Opening…
                </>
              ) : (
                'Open clinic admin portal'
              )}
            </button>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
};

export default ClinicSetupPage;
