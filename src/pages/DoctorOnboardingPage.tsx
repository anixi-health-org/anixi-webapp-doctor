import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfessionalProfileForm from '../components/ProfessionalProfileForm';
import { OnboardingShell } from '../components/onboarding/OnboardingShell';
import { getOnboardingStepMeta } from '../components/onboarding/OnboardingProgress';
import { AppShellSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/AuthContext';
import { clinicAdminHomePath, doctorHomePath, getDoctorAccessState, isClinicOwner } from '../lib/doctorAccess';
import type { Doctor } from '../types';

const PROFILE_SUB_LABELS = ['Personal details', 'Professional details', 'Practice details'];

/** Doctor credential onboarding (HPCSA review). Separate from clinic bulk setup. */
export const DoctorOnboardingPage: React.FC = () => {
  const { user, refreshUser, practiceSession, clinicOnboardingComplete } = useAuth();
  const navigate = useNavigate();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const [profileStep, setProfileStep] = useState(1);

  useEffect(() => {
    if (!doctor) return;
    if (isClinicOwner(practiceSession)) {
      navigate(clinicOnboardingComplete ? clinicAdminHomePath() : '/clinic-setup', {
        replace: true,
      });
      return;
    }
    const state = getDoctorAccessState(doctor);
    if (state !== 'onboarding' && state !== 'rejected' && state !== 'suspended') {
      navigate(doctorHomePath(doctor), { replace: true });
    }
  }, [doctor, navigate, practiceSession, clinicOnboardingComplete]);

  const stepMeta = getOnboardingStepMeta('solo', 1);

  if (!doctor) {
    return <AppShellSkeleton />;
  }

  return (
    <OnboardingShell
      flow="solo"
      currentStep={1}
      subProgress={{
        current: profileStep,
        total: 3,
        label: PROFILE_SUB_LABELS[profileStep - 1] ?? 'Profile',
      }}
      title={stepMeta.title}
      subtitle={stepMeta.subtitle}
      maxWidth="full"
      onBack={profileStep > 1 ? () => setProfileStep((s) => Math.max(1, s - 1)) : undefined}
      backLabel="Back"
    >
      <ProfessionalProfileForm
        mode="onboarding"
        onStepChange={setProfileStep}
        onSubmitted={async () => {
          await refreshUser();
          navigate('/account-review', { replace: true });
        }}
      />
    </OnboardingShell>
  );
};
