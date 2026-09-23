import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../hooks/AuthContext';
import { getJoinPathConfig } from '../lib/joinPathConfig';
import {
  djangoGetMyMarketplacePartnerApplication,
  type MarketplacePartnerApplication,
} from '../services/djangoApiService';

export const MarketPartnerReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [app, setApp] = useState<MarketplacePartnerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const heroSlides = getJoinPathConfig('market_partner').heroSlides;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await djangoGetMyMarketplacePartnerApplication();
        if (!cancelled) setApp(row);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = app?.status ?? 'pending';

  useEffect(() => {
    if (!loading && status === 'approved') {
      navigate('/partner', { replace: true });
    }
  }, [loading, status, navigate]);

  const goToSignIn = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
      setSigningOut(false);
    }
  };

  const layoutTitle =
    status === 'approved'
      ? 'You’re live on the Market'
      : status === 'rejected'
        ? 'Application needs changes'
        : 'Application under review';

  const layoutSubtitle =
    status === 'approved'
      ? 'Opening your partner portal…'
      : status === 'rejected'
        ? 'Update your details and resubmit for another review.'
        : 'Anixi admin will verify your Market Partner listing before patients can see it.';

  return (
    <AuthLayout title={layoutTitle} subtitle={layoutSubtitle} maxWidth="xl" heroSlides={heroSlides}>
      <Card>
        <CardHeader>
          <CardTitle>
            {status === 'approved'
              ? 'Listing published'
              : status === 'rejected'
                ? 'Not approved yet'
                : 'Pending admin approval'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          {loading || status === 'approved' ? (
            <p>{status === 'approved' ? 'Taking you to your partner portal…' : 'Checking application status…'}</p>
          ) : status === 'rejected' ? (
            <>
              <p>
                Your application for <strong>{app?.businessName}</strong> was not approved.
              </p>
              {app?.rejectionReason ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                  {app.rejectionReason}
                </p>
              ) : null}
              <Link
                to="/market-partner/onboarding"
                className="inline-flex font-semibold text-anixi-green underline"
              >
                Update and resubmit
              </Link>
            </>
          ) : (
            <>
              <p>
                Thanks{app?.businessName ? ` — we received ${app.businessName}` : ''}. Our team
                reviews partner listings before they appear to patients.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>You’ll get access to the partner portal once approved</li>
                <li>Offerings you submitted are reviewed with your profile</li>
                <li>Check back here any time after signing in</li>
              </ul>
            </>
          )}
          {status !== 'approved' ? (
            <button
              type="button"
              onClick={() => void goToSignIn()}
              disabled={signingOut}
              className="inline-flex pt-2 font-semibold text-anixi-green underline disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out & go to sign in'}
            </button>
          ) : null}
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
