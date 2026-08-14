import React, { useEffect, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Toast } from '../components/ui';
import { useAuth } from '../hooks/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { RegisterPrompt } from '../components/auth/AuthLinks';
import { professionalHomePath } from '../lib/doctorAccess';

const inputClassName =
  'mt-1.5 block w-full rounded-xl border border-[#d9e0da] bg-white px-3.5 py-3 text-[15px] text-[#1f2a26] placeholder:text-[#9aa59f] shadow-sm transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20 disabled:bg-[#f4f6f5] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff]';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, isAuthenticated, user, practiceSession, joinIntent, clinicOnboardingComplete } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccess('Account created successfully. Please sign in.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    if (returnUrl && returnUrl.startsWith('/')) {
      navigate(returnUrl, { replace: true });
      return;
    }

    navigate(
      professionalHomePath(user, {
        joinIntent,
        hasPractice: Boolean(practiceSession),
        clinicOnboardingComplete,
        isClinicOwner:
          practiceSession?.practice?.orgType === 'clinic' &&
          practiceSession?.member?.role === 'owner',
        practiceSession,
      }),
      { replace: true }
    );
  }, [
    isLoading,
    isAuthenticated,
    user,
    returnUrl,
    navigate,
    joinIntent,
    practiceSession,
    clinicOnboardingComplete,
  ]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => setToast({ message: '', visible: false }), 5000);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const signedIn = await login(email.trim(), password);

      if (!signedIn) {
        setError('Invalid email or password.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not sign in. Please try again.';
      if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('register')) {
        setToast({ message: msg, visible: true });
        setError(msg);
        return;
      }
      setError(msg);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to the Anixi Health portal">
      {toast.visible && (
        <Toast
          message={toast.message}
          type="error"
          onClose={() => setToast({ message: '', visible: false })}
        />
      )}
      <Card className="border-[#e4ebe6] !bg-white !shadow-[0_18px_50px_rgba(31,49,42,0.08)]">
        <CardContent className="px-6 py-7 sm:px-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-anixi-green">
              Secure sign in
            </p>
            <h2 className="mt-1.5 font-heading text-xl font-semibold text-[#1f2a26]">
              Doctor & clinic portal
            </h2>
          </div>
          {success && (
            <div className="mb-4 rounded-xl bg-[#eef6f1] px-3.5 py-2.5 text-sm text-[#2f5a46]">
              {success}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#3d4d46]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={inputClassName}
                placeholder="you@practice.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#3d4d46]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`${inputClassName} pr-12`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-2 mt-1.5 flex items-center px-2 text-[#8a9690] hover:text-[#425950]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full rounded-xl bg-anixi-green py-3 px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-anixi-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="mt-6 border-t border-[#eef2ef] pt-5">
            <RegisterPrompt />
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
