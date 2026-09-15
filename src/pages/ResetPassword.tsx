import React, { useMemo, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { AuthLayout } from '../components/auth/AuthLayout';
import { djangoPasswordResetConfirm } from '../services/djangoApiService';

const MIN_PASSWORD_LENGTH = 10;

const inputClassName =
  'mt-1.5 block w-full rounded-xl border border-[#d9e0da] bg-white px-3.5 py-3 text-[15px] text-[#1f2a26] placeholder:text-[#9aa59f] shadow-sm transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20 disabled:bg-[#f4f6f5] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff]';

function decodeResetCode(raw: string | null): string {
  if (!raw) return '';
  let decoded = raw.trim();
  for (let i = 0; i < 2; i += 1) {
    if (!decoded.includes('%')) break;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }
  return decoded;
}

export const ResetPassword: React.FC = () => {
  const { code: pathCode } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const oobCode = useMemo(
    () =>
      decodeResetCode(
        pathCode ?? searchParams.get('oobCode') ?? searchParams.get('code'),
      ),
    [pathCode, searchParams],
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oobCode) {
      setError('Invalid or expired reset link. Please request a new one.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await djangoPasswordResetConfirm(oobCode, password);
      setChanged(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a password of at least 10 characters, then sign in."
    >
      <Card className="border-[#e4ebe6] !bg-white !shadow-[0_18px_50px_rgba(31,49,42,0.08)]">
        <CardContent className="px-6 py-7 sm:px-8">
          {changed ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#3d4d46]">
                Your password has been updated. You can sign in with it in the portal or
                the Anixi app.
              </p>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-anixi-green py-3 px-4 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-[#3d4d46]">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`${inputClassName} pr-12`}
                    placeholder="At least 10 characters"
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
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-[#3d4d46]">
                  Repeat password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={inputClassName}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
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
                disabled={isLoading || !oobCode}
                className="mt-1 w-full rounded-xl bg-anixi-green py-3 px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-anixi-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Saving…' : 'Save new password'}
              </button>
              {!oobCode ? (
                <p className="text-center text-sm text-[#8a9690]">
                  Missing reset code.{' '}
                  <Link to="/forgot-password" className="font-semibold text-anixi-green hover:underline">
                    Request a new link
                  </Link>
                </p>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
