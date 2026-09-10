import React, { useEffect, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Toast } from '../components/ui';
import { AuthLayout } from '../components/auth/AuthLayout';
import { ChangeRoleLink, SignInPrompt } from '../components/auth/AuthLinks';
import { RegisterPathPreview } from '../components/auth/RegisterPathPreview';
import { useAuth } from '../hooks/AuthContext';
import { registerProfessional } from '../services/authService';
import { getJoinPathConfig } from '../lib/joinPathConfig';
import { parseAuthRole, parseJoinPath } from '../types/auth';
import {
  PRACTICE_COUNTRIES,
  detectDefaultCountryCode,
} from '../constants/countries';

export const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const role = parseAuthRole(searchParams.get('role'));
  const joinPath =
    parseJoinPath(searchParams.get('path')) ||
    (role === 'caregiver' ? 'caregiver' : 'solo_doctor');
  const pathConfig = getJoinPathConfig(joinPath);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState(() => detectDefaultCountryCode());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => setToast({ message: '', visible: false }), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  if (!role) {
    return <Navigate to="/join" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@company.com)');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }

    setIsLoading(true);
    try {
      await registerProfessional(
        trimmedEmail,
        password,
        displayName,
        role,
        pathConfig.showCountryField ? country : undefined,
        joinPath,
      );

      await refreshUser();
      navigate(pathConfig.postRegisterPath(joinPath), { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string; detail?: string };
      const message = apiErr.message || apiErr.detail || 'Registration failed';
      if (
        apiErr.code === 'auth/email-already-in-use' ||
        /already exists|already registered|duplicate/i.test(message)
      ) {
        setError('An account with this email already exists');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={pathConfig.layoutTitle}
      subtitle={pathConfig.layoutSubtitle}
      heroSlides={pathConfig.heroSlides}
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
          <CardTitle className="text-center">{pathConfig.cardTitle}</CardTitle>
          <p className="mt-2 text-center text-sm leading-relaxed text-gray-500">
            {pathConfig.cardDescription}
          </p>
        </CardHeader>
        <CardContent>
          <RegisterPathPreview joinPath={joinPath} />
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                {pathConfig.nameLabel}
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="name"
                required
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green sm:text-sm"
                placeholder={pathConfig.namePlaceholder}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
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
                placeholder={pathConfig.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {pathConfig.showCountryField && role === 'doctor' && (
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country of practice
                </label>
                <select
                  id="country"
                  name="country"
                  required
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green sm:text-sm"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  {PRACTICE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Invoices and fees will use your local currency.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green sm:text-sm"
                  placeholder="Create a password"
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
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green sm:text-sm"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-anixi-green py-2.5 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-anixi-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? pathConfig.submitLoadingLabel : pathConfig.submitLabel}
            </button>
          </form>
          <div className="mt-6 space-y-3 pt-2">
            <SignInPrompt />
            <ChangeRoleLink />
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
