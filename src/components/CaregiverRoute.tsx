import React from 'react';
import { Navigate } from 'react-router-dom';
import { CaregiverAppShellSkeleton } from './ui';
import { useAuth } from '../hooks/AuthContext';

interface CaregiverRouteProps {
  children: React.ReactNode;
}

export const CaregiverRoute: React.FC<CaregiverRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <CaregiverAppShellSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'caregiver') {
    return <Navigate to={user?.role === 'doctor' ? '/dashboard' : '/login'} replace />;
  }

  return <>{children}</>;
};
