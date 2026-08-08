import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { AppShellSkeleton } from './ui/Skeleton';
import {
  clinicAdminHomePath,
  getDoctorAccessState,
  isClinicOwner,
  professionalHomePath,
  usesClinicAdminPortal,
} from '../lib/doctorAccess';
import type { Doctor } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ONBOARDING_PATH = '/onboarding';
const REVIEW_PATH = '/account-review';
const CLINIC_SETUP_PATH = '/clinic-setup';
const CLINIC_ADMIN_PREFIX = '/clinic';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, practiceSession, joinIntent, clinicOnboardingComplete } =
    useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppShellSkeleton />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const path = location.pathname;
  const clinicOwner = isClinicOwner(practiceSession);
  const clinicAdmin = usesClinicAdminPortal(practiceSession);
  const isClinicAdminPath =
    path === CLINIC_ADMIN_PREFIX || path.startsWith(`${CLINIC_ADMIN_PREFIX}/`);

  // Staff (receptionist / billing) — land in clinic admin when membership allows.
  if (user?.role === 'staff') {
    if (!practiceSession?.member) {
      return <Navigate to="/join/invite" replace />;
    }
    if (clinicAdmin) {
      if (isClinicAdminPath || path === CLINIC_SETUP_PATH) {
        return <>{children}</>;
      }
      return <Navigate to={clinicAdminHomePath()} replace />;
    }
    return <>{children}</>;
  }

  if (user?.role !== 'doctor') {
    return <Navigate to={user?.role === 'caregiver' ? '/caregiver' : '/login'} replace />;
  }

  const doctor = user as Doctor;
  const access = getDoctorAccessState(doctor);
  const onGatePage =
    path === ONBOARDING_PATH || path === REVIEW_PATH || path === CLINIC_SETUP_PATH;
  const needsClinicSetup = joinIntent === 'clinic' && !practiceSession;

  if (needsClinicSetup) {
    if (path === CLINIC_SETUP_PATH) {
      return <>{children}</>;
    }
    return <Navigate to={CLINIC_SETUP_PATH} replace />;
  }

  if (clinicOwner || clinicAdmin) {
    // Only clinic owners must finish the setup wizard.
    if (clinicOwner && !clinicOnboardingComplete) {
      if (path === CLINIC_SETUP_PATH) {
        return <>{children}</>;
      }
      return <Navigate to={CLINIC_SETUP_PATH} replace />;
    }

    if (path === ONBOARDING_PATH || path === REVIEW_PATH) {
      return <Navigate to={clinicAdminHomePath()} replace />;
    }

    if (isClinicAdminPath || path === CLINIC_SETUP_PATH) {
      return <>{children}</>;
    }

    return <Navigate to={clinicAdminHomePath()} replace />;
  }

  if (path === CLINIC_SETUP_PATH && !practiceSession) {
    return <>{children}</>;
  }

  if (access === 'full') {
    if (onGatePage && path !== CLINIC_SETUP_PATH) {
      return <Navigate to="/dashboard" replace />;
    }
    if (path === CLINIC_SETUP_PATH && practiceSession && clinicOnboardingComplete) {
      return <Navigate to="/dashboard" replace />;
    }
    if (isClinicAdminPath) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (access === 'onboarding') {
    if (path === CLINIC_SETUP_PATH) {
      return <>{children}</>;
    }
    if (path !== ONBOARDING_PATH) {
      return <Navigate to={ONBOARDING_PATH} replace />;
    }
    return <>{children}</>;
  }

  if (path === ONBOARDING_PATH && (access === 'rejected' || access === 'suspended')) {
    return <>{children}</>;
  }
  if (path !== REVIEW_PATH && path !== ONBOARDING_PATH && path !== CLINIC_SETUP_PATH) {
    return (
      <Navigate
        to={professionalHomePath(doctor, {
          joinIntent,
          hasPractice: Boolean(practiceSession),
          clinicOnboardingComplete,
          isClinicOwner: clinicOwner,
          practiceSession,
        })}
        replace
      />
    );
  }

  return <>{children}</>;
};
