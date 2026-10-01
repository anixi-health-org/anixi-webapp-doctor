import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

/** Blocks routes that require manageContent (Content Creator / admin). */
export const ContentPermissionRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { canManageContent, can } = usePermissions();
  const location = useLocation();

  if (!canManageContent && !can('manageContent')) {
    const fallback = location.pathname.startsWith('/clinic') ? '/clinic' : '/ayah';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};
