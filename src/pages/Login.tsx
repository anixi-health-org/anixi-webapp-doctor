import React, { useEffect, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Toast } from '../components/ui';
import { useAuth } from '../hooks/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { RegisterPrompt } from '../components/auth/AuthLinks';
import { professionalHomePath } from '../lib/doctorAccess';

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
    if (toast.visible) {
      const timer = setTimeout(() => setToast({ message: '', visible: false }), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const signedIn = await login(email, password);

      if (!signedIn) {
        setError('Invalid email or password');
        return;
      }

      // Redirect is handled by the authenticated useEffect once joinIntent is loaded
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('register')) {
        setToast({ message: msg, visible: true });
      } else {
        setError('Invalid email or password');
      }
    }
  };

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Anixi Health Portal"
    >
      {toast.visible && (
        <Toast
          message={toast.message}
          type="error"
          onClose={() => setToast({ message: '', visible: false })}
        />
      )}
      <Card className="!bg-white !shadow-lg border-gray-100">
        <CardHeader>
          <CardTitle className="text-center">Login</CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
              {success}
            </div>
          )}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green sm:text-sm"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green sm:text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center px-2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-anixi-green py-2.5 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-anixi-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <div className="mt-6 pt-2">
            <RegisterPrompt />
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
