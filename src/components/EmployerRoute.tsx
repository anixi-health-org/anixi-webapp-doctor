import React from 'react';
import { Navigate } from 'react-router-dom';
import { AppShellSkeleton } from './ui/Skeleton';
import { useAuth } from '../hooks/AuthContext';

type EmployerRouteProps = {
  children: React.ReactNode;
};

/** Authenticated users may access employer setup or dashboard. */
export const EmployerRoute: React.FC<EmployerRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
