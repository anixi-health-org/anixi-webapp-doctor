import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { AppShellSkeleton } from './ui/Skeleton';
import { doctorHomePath, getDoctorAccessState } from '../lib/doctorAccess';
import type { Doctor } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ONBOARDING_PATH = '/onboarding';
const REVIEW_PATH = '/account-review';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppShellSkeleton />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'doctor') {
    return <Navigate to={user?.role === 'caregiver' ? '/caregiver' : '/login'} replace />;
  }

  const doctor = user as Doctor;
  const access = getDoctorAccessState(doctor);
  const path = location.pathname;
  const onGatePage = path === ONBOARDING_PATH || path === REVIEW_PATH;

  if (access === 'full') {
    if (onGatePage) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (access === 'onboarding') {
    if (path !== ONBOARDING_PATH) {
      return <Navigate to={ONBOARDING_PATH} replace />;
    }
    return <>{children}</>;
  }

  // under_review | rejected | suspended
  if (path === ONBOARDING_PATH && (access === 'rejected' || access === 'suspended')) {
    return <>{children}</>;
  }
  if (path !== REVIEW_PATH && path !== ONBOARDING_PATH) {
    return <Navigate to={doctorHomePath(doctor)} replace />;
  }

  return <>{children}</>;
};
