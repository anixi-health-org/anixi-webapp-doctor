import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { AuthLayout } from '../components/auth/AuthLayout';
import { SignInPrompt } from '../components/auth/AuthLinks';
import { useAuth } from '../hooks/AuthContext';
import { clinicAdminHomePath } from '../lib/doctorAccess';
import { ROLE_LABELS } from '../lib/practiceRoles';
import { registerProfessional } from '../services/authService';
import {
  acceptPracticeInvite,
  getPracticeInvite,
} from '../services/practiceInviteService';
import type { PracticeInvite, PracticeRole } from '../types';
import type { AuthRole } from '../types/auth';
import { getJoinPathConfig } from '../lib/joinPathConfig';
import JoinInviteLandingPage from './JoinInviteLandingPage';

const doctorAuthRoles: PracticeRole[] = [
  'owner',
  'doctor',
  'nurse',
  'allied_health',
  'locum',
  'practice_manager',
];
const clinicAdminRoles: PracticeRole[] = [
  'practice_manager',
  'receptionist',
  'billing_clerk',
];

export const InviteAcceptPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login, refreshPracticeSession, refreshUser, isAuthenticated } = useAuth();

  const practiceId = searchParams.get('practiceId') || '';
  const inviteId = searchParams.get('inviteId') || '';
  const token = searchParams.get('token') || '';

  const [invite, setInvite] = useState<PracticeInvite | null>(null);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inviteConfig = getJoinPathConfig('invite');
  const hasInviteParams = Boolean(practiceId && inviteId);

  useEffect(() => {
    if (!hasInviteParams) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getPracticeInvite(practiceId, inviteId);
        if (cancelled) return;
        if (!data) {
          setLoadError('Invitation not found.');
          return;
        }
        if (data.token !== token) {
          setLoadError('Invalid invitation link.');
          return;
        }
        if (data.status !== 'pending') {
          setLoadError('This invitation has already been used or revoked.');
          return;
        }
        setInvite(data);
        setEmail(data.email);
        setDisplayName(data.displayName || '');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load invitation');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId, inviteId, token, hasInviteParams]);

  if (!hasInviteParams) {
    return <JoinInviteLandingPage />;
  }

  const finishAccept = async (
    uid: string,
    userEmail: string,
    name?: string,
    role?: PracticeRole
  ) => {
    await acceptPracticeInvite({
      practiceId,
      inviteId,
      token,
      uid,
      email: userEmail,
      displayName: name,
    });
    await refreshPracticeSession();
    await refreshUser();
    const acceptedRole = role || invite?.role;

    if (acceptedRole && clinicAdminRoles.includes(acceptedRole)) {
      navigate(clinicAdminHomePath(), { replace: true });
      return;
    }

    if (acceptedRole === 'doctor') {
      navigate('/onboarding', { replace: true });
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setError('');
    setSubmitting(true);
    try {
      const authRole: AuthRole = doctorAuthRoles.includes(invite.role) ? 'doctor' : 'staff';

      if (isAuthenticated && user) {
        await finishAccept(user.id, user.email, user.displayName, invite.role);
        return;
      }

      if (mode === 'register') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        await registerProfessional(email, password, displayName || invite.displayName || email, authRole);
        const professional = await login(email, password, authRole);
        if (!professional) throw new Error('Could not sign in after registration');
        await finishAccept(
          professional.id,
          professional.email,
          professional.displayName,
          invite.role
        );
      } else {
        const professional = await login(email, password);
        if (!professional) throw new Error('Login failed');
        await finishAccept(
          professional.id,
          professional.email,
          professional.displayName,
          invite.role
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <AuthLayout
        title="Invitation"
        subtitle="We couldn't open this invite"
        maxWidth="xl"
        compact
        heroSlides={inviteConfig.heroSlides}
      >
        <div className="rounded-2xl border border-gray-100 bg-white px-8 py-10 text-center shadow-lg sm:px-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <span className="text-xl font-semibold" aria-hidden>
              !
            </span>
          </div>
          <p className="text-base font-medium text-red-700">{loadError}</p>
          <p className="mt-3 text-sm text-gray-500">
            Open the full link from your clinic email, or ask them to send a new invitation.
          </p>
          <Link
            to="/join"
            className="mt-8 inline-flex rounded-full bg-anixi-green px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Back to join
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!invite) {
    return (
      <AuthLayout
        title="Invitation"
        subtitle="Loading your invite…"
        maxWidth="xl"
        compact
        heroSlides={inviteConfig.heroSlides}
      >
        <div className="rounded-2xl border border-gray-100 bg-white px-8 py-10 text-center text-base text-gray-500 shadow-lg">
          Please wait…
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="You're invited"
      subtitle={`Join ${invite.practiceName} as ${ROLE_LABELS[invite.role]}`}
      maxWidth="xl"
      heroSlides={inviteConfig.heroSlides}
    >
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-7 shadow-lg sm:px-8 sm:py-8">
        <div className="mb-6 rounded-xl bg-[#eef4f1] px-4 py-3 text-sm text-[#344256]">
          <p className="font-medium">{invite.practiceName}</p>
          <p className="mt-1 text-[#65758b]">
            Invited as <strong>{ROLE_LABELS[invite.role]}</strong>
            {invite.invitedByName ? ` by ${invite.invitedByName}` : ''}
          </p>
        </div>

        {!isAuthenticated && (
          <div className="mb-5 flex rounded-full bg-gray-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-full py-2 font-medium ${
                mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-full py-2 font-medium ${
                mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              I already have an account
            </button>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && !isAuthenticated && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              readOnly
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-400">Must match the invited email address</p>
          </div>
          {!isAuthenticated && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-anixi-green py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting
              ? 'Joining…'
              : isAuthenticated
                ? 'Accept invitation'
                : mode === 'register'
                  ? 'Create account & join'
                  : 'Sign in & join'}
          </button>
        </form>

        {!isAuthenticated && (
          <div className="mt-6">
            <SignInPrompt />
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default InviteAcceptPage;
