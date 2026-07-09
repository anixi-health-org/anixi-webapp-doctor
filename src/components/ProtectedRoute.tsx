import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { AppShellSkeleton } from './ui/Skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return <AppShellSkeleton />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'doctor') {
    return <Navigate to={user?.role === 'caregiver' ? '/caregiver' : '/login'} replace />;
  }
  return <>{children}</>;
};
