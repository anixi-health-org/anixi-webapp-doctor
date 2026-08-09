import React from 'react';
import { Navigate } from 'react-router-dom';
import { AppShellSkeleton } from './ui/Skeleton';
import { useAuth } from '../hooks/AuthContext';
import { isClinicOwner, usesClinicAdminPortal } from '../lib/doctorAccess';

type ClinicAdminRouteProps = {
  children: React.ReactNode;
};

export const ClinicAdminRoute: React.FC<ClinicAdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, practiceSession, clinicOnboardingComplete } = useAuth();

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!usesClinicAdminPortal(practiceSession)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Staff joining an existing clinic skip the owner's setup wizard.
  if (isClinicOwner(practiceSession) && !clinicOnboardingComplete) {
    return <Navigate to="/clinic-setup" replace />;
  }

  return <>{children}</>;
};
