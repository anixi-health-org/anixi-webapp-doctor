import React, { useState } from 'react';
import { ClockIcon, ExclamationTriangleIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { OnboardingShell } from '../components/onboarding/OnboardingShell';
import { getOnboardingStepMeta } from '../components/onboarding/OnboardingProgress';
import { AppShellSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/AuthContext';
import { doctorHomePath, getDoctorAccessState, isClinicEmployedClinician } from '../lib/doctorAccess';
import { getCurrentProfessionalFromSession } from '../services/authService';
import type { Doctor } from '../types';

export const AccountUnderReviewPage: React.FC = () => {
  const { user, practiceSession, joinIntent, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const state = doctor ? getDoctorAccessState(doctor) : 'under_review';
  const clinicEmployed = isClinicEmployedClinician(practiceSession, {
    joinIntent,
    accountKind: doctor?.accountKind,
  });
  const clinicName =
    practiceSession?.practice?.tradingName || practiceSession?.practice?.name || '';
  const stepMeta = getOnboardingStepMeta('solo', 2);
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const copy =
    state === 'rejected'
      ? {
          icon: ExclamationTriangleIcon,
          title: 'Application not approved',
          body:
            doctor?.rejectionReason ||
            'Your doctor application was not approved. Please update your details and contact Anixi Support if you need help.',
          tone: 'text-amber-800 bg-amber-50 border-amber-200',
        }
      : state === 'suspended'
        ? {
            icon: NoSymbolIcon,
            title: 'Account suspended',
            body:
              doctor?.rejectionReason ||
              'Your account has been suspended. Please contact Anixi Support for assistance.',
            tone: 'text-red-700 bg-red-50 border-red-200',
          }
        : state === 'on_hold'
          ? {
              icon: ClockIcon,
              title: 'Account on hold',
              body:
                doctor?.rejectionReason ||
                'Anixi Admin has placed this account on hold for further review. You can sign in, but access stays limited until the review is complete.',
              tone: 'text-amber-800 bg-amber-50 border-amber-200',
            }
          : {
              icon: ClockIcon,
              title: 'Account under review',
              body: clinicEmployed
                ? `Thanks for submitting your details. Anixi Admin is reviewing your credentials for ${clinicName || 'your clinic'}. Full access unlocks once you are approved.`
                : 'Thanks for submitting your details. Anixi Admin is reviewing your application. Full access unlocks once your account is approved.',
              tone: 'text-[#344256] bg-[#eef4f1] border-[#427160]/20',
            };

  const Icon = copy.icon;

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusNote('');
    try {
      await refreshUser();
      const professional = await getCurrentProfessionalFromSession();
      if (professional?.role === 'doctor') {
        const access = getDoctorAccessState(professional as Doctor);
        if (access === 'full') {
          navigate(doctorHomePath(professional as Doctor), { replace: true });
          return;
        }
      }
      setStatusNote('Still under review. We will email you when Anixi Admin makes a decision.');
    } catch {
      setStatusNote('Could not check status right now. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setSigningOut(false);
      setStatusNote('Could not sign out. Try again.');
    }
  };

  if (!doctor) {
    return <AppShellSkeleton />;
  }

  return (
    <OnboardingShell
      flow="solo"
      currentStep={2}
      title={state === 'under_review' ? stepMeta.title : copy.title}
      subtitle={
        state === 'under_review'
          ? 'Typical review time is 1 to 2 business days. You can close this tab and sign in again any time.'
          : copy.body
      }
      maxWidth="full"
    >
      <div className="grid gap-6 lg:grid-cols-5 lg:items-stretch">
        <section className={`rounded-2xl border p-6 shadow-sm sm:p-8 lg:col-span-3 ${copy.tone}`}>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight">{copy.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-90">{copy.body}</p>
            </div>
          </div>

          {state === 'under_review' && (
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { n: '1', label: 'Profile submitted', done: true },
                { n: '2', label: 'Admin review', done: false },
                { n: '3', label: clinicEmployed ? 'Join clinic workspace' : 'Open your portal', done: false },
              ].map((item) => (
                <li
                  key={item.label}
                  className="rounded-xl border border-white/70 bg-white/60 px-4 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    Step {item.n}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#344256]">{item.label}</p>
                  <p className="mt-1 text-xs text-[#65758b]">{item.done ? 'Complete' : 'Waiting'}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="flex flex-col rounded-2xl border border-[#e1e7ef] bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-anixi-green">
            This session
          </p>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[#65758b]">Signed in as</dt>
              <dd className="mt-0.5 font-medium text-[#344256]">
                {doctor.displayName || doctor.email || 'Doctor'}
              </dd>
              {doctor.email && doctor.displayName ? (
                <dd className="mt-0.5 text-[#65758b]">{doctor.email}</dd>
              ) : null}
            </div>
            {clinicName ? (
              <div>
                <dt className="text-[#65758b]">Clinic</dt>
                <dd className="mt-0.5 font-medium text-[#344256]">{clinicName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[#65758b]">Application</dt>
              <dd className="mt-0.5 font-medium capitalize text-[#344256]">
                {state.replace('_', ' ')}
              </dd>
            </div>
          </dl>

          {statusNote ? (
            <p className="mt-5 rounded-xl bg-[#f4f7f5] px-3 py-2.5 text-sm text-[#344256]">
              {statusNote}
            </p>
          ) : null}

          <div className="mt-auto flex flex-col gap-3 pt-8">
            {(state === 'rejected' || state === 'suspended') && (
              <button
                type="button"
                onClick={() => navigate('/onboarding')}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#e1e7ef] bg-white px-4 text-sm font-semibold text-[#344256] hover:bg-[#f8fafc]"
              >
                Update application details
              </button>
            )}
            <button
              type="button"
              disabled={checking || signingOut}
              onClick={() => void handleCheckStatus()}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-anixi-green px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? 'Checking…' : 'Check approval status'}
            </button>
            <button
              type="button"
              disabled={checking || signingOut}
              onClick={() => void handleSignOut()}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border-2 border-[#344256] bg-white px-4 text-sm font-semibold text-[#344256] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </aside>
      </div>
    </OnboardingShell>
  );
};
