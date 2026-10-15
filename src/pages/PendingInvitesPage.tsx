import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { useAuth } from '../hooks/AuthContext';
import { getJoinPathConfig } from '../lib/joinPathConfig';
import { clinicAdminHomePath } from '../lib/doctorAccess';
import { djangoListMyPracticeInvites } from '../services/djangoApiService';

/**
 * After sign-in, staff/doctors without a practice membership land here.
 * Loads pending email invites and continues the classic accept flow.
 */
export const PendingInvitesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, practiceSession, joinIntent, logout } = useAuth();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const config = getJoinPathConfig('invite');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (joinIntent === 'market_partner') {
      navigate('/partner', { replace: true });
      return;
    }
    if (practiceSession?.member) {
      navigate(clinicAdminHomePath(), { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const invites = await djangoListMyPracticeInvites('pending');
        if (cancelled) return;
        const invite = invites[0];
        if (invite?.practiceId && invite?.id && invite?.token) {
          const qs = new URLSearchParams({
            practiceId: String(invite.practiceId),
            inviteId: String(invite.id),
            token: String(invite.token),
          });
          navigate(`/join/invite?${qs}`, { replace: true });
          return;
        }
        setError(
          'No pending practice invitation was found for this email. Open the Accept invite link from your invitation email, or ask your clinic to resend it.',
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load invitations');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, joinIntent, navigate, practiceSession?.member, user?.email]);

  const goToSignIn = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
      setSigningOut(false);
    }
  };

  return (
    <AuthLayout
      title="Looking for your invite"
      subtitle="We’ll open your pending practice invitation if one exists for this account"
      maxWidth="xl"
      compact
      heroSlides={config.heroSlides}
    >
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-8 text-center shadow-lg sm:px-8">
        {checking ? (
          <p className="text-sm text-gray-500">Checking invitations for {user?.email}…</p>
        ) : (
          <>
            <p className="text-sm text-gray-700">{error}</p>
            <p className="mt-3 text-sm text-gray-500">
              Invites are sent from info@anixihealth.com. Use the Accept invite button in that email
              to create your password.
            </p>
            {user?.email ? (
              <p className="mt-2 text-xs text-gray-400">Signed in as {user.email}</p>
            ) : null}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => void goToSignIn()}
                disabled={signingOut}
                className="inline-flex rounded-full bg-anixi-green px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {signingOut ? 'Signing out…' : 'Sign out & go to sign in'}
              </button>
              <p className="text-center text-sm text-gray-600">
                Wrong account?{' '}
                <button
                  type="button"
                  onClick={() => void goToSignIn()}
                  disabled={signingOut}
                  className="font-semibold text-anixi-green hover:underline disabled:opacity-60"
                >
                  Use a different email
                </button>
              </p>
              <p className="text-center text-sm text-gray-500">
                <Link to="/join" className="font-medium text-anixi-green hover:underline">
                  Choose a different path
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default PendingInvitesPage;
