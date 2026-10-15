import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppShellSkeleton } from './ui/Skeleton';
import { useAuth } from '../hooks/AuthContext';
import { djangoGetMyMarketplacePartnerApplication } from '../services/djangoApiService';

type PartnerRouteProps = {
  children: React.ReactNode;
};

/**
 * Approved market partners only. Pending/rejected → review; no app → onboarding.
 */
export const PartnerRoute: React.FC<PartnerRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, joinIntent, user } = useAuth();
  const [gate, setGate] = useState<'loading' | 'approved' | 'review' | 'onboarding'>('loading');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || joinIntent !== 'market_partner' || user?.role !== 'staff') {
      setGate('review');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const app = await djangoGetMyMarketplacePartnerApplication();
        if (cancelled) return;
        if (!app) {
          setGate('onboarding');
          return;
        }
        if (app.status === 'approved') {
          setGate('approved');
          return;
        }
        setGate('review');
      } catch {
        if (!cancelled) setGate('review');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, joinIntent, user?.role]);

  if (isLoading || gate === 'loading') {
    return <AppShellSkeleton />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (joinIntent !== 'market_partner' || user?.role !== 'staff') {
    return <Navigate to="/login" replace />;
  }
  if (gate === 'onboarding') {
    return <Navigate to="/market-partner/onboarding" replace />;
  }
  if (gate === 'review') {
    return <Navigate to="/market-partner/review" replace />;
  }
  return <>{children}</>;
};
