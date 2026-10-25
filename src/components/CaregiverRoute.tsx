import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CaregiverAppShellSkeleton } from './ui';
import { useAuth } from '../hooks/AuthContext';
import {
  markCaregiverOnboardingComplete,
  readCaregiverOnboardingComplete,
} from '../pages/CaregiverOnboardingPage';
import { getCaregiverProfile } from '../services/caregiverService';

interface CaregiverRouteProps {
  children: React.ReactNode;
  /** Set on /caregiver/onboarding so users are not redirected in a loop */
  skipOnboardingCheck?: boolean;
}

export const CaregiverRoute: React.FC<CaregiverRouteProps> = ({
  children,
  skipOnboardingCheck = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const isCaregiver = user?.role === 'caregiver';
  const localDone = Boolean(user?.id && readCaregiverOnboardingComplete(user.id));
  // Onboarding state lives on the server; localStorage only avoids a round trip on this device.
  const [serverDone, setServerDone] = useState<boolean | null>(localDone ? true : null);

  useEffect(() => {
    if (skipOnboardingCheck || !isCaregiver || !user?.id || localDone) return;
    let cancelled = false;
    getCaregiverProfile()
      .then((profile) => {
        if (cancelled) return;
        const done = Boolean(profile?.onboardingCompleted);
        if (done) markCaregiverOnboardingComplete(user.id);
        setServerDone(done);
      })
      .catch(() => {
        if (!cancelled) setServerDone(false);
      });
    return () => {
      cancelled = true;
    };
  }, [skipOnboardingCheck, isCaregiver, user?.id, localDone]);

  if (isLoading || (isCaregiver && !skipOnboardingCheck && !localDone && serverDone === null)) {
    return <CaregiverAppShellSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'caregiver') {
    return <Navigate to={user?.role === 'doctor' ? '/dashboard' : '/login'} replace />;
  }

  if (
    !skipOnboardingCheck &&
    user.id &&
    !localDone &&
    serverDone !== true &&
    location.pathname !== '/caregiver/onboarding'
  ) {
    return <Navigate to="/caregiver/onboarding" replace />;
  }

  return <>{children}</>;
};
