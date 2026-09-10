import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CaregiverAppShellSkeleton } from './ui';
import { useAuth } from '../hooks/AuthContext';
import { readCaregiverOnboardingComplete } from '../pages/CaregiverOnboardingPage';

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

  if (isLoading) {
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
    !readCaregiverOnboardingComplete(user.id) &&
    location.pathname !== '/caregiver/onboarding'
  ) {
    return <Navigate to="/caregiver/onboarding" replace />;
  }

  return <>{children}</>;
};
