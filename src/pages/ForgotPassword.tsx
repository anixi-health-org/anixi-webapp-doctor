import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { AuthLayout } from '../components/auth/AuthLayout';
import { SignInPrompt } from '../components/auth/AuthLinks';
import { djangoPasswordResetRequest } from '../services/djangoApiService';

const inputClassName =
  'mt-1.5 block w-full rounded-xl border border-[#d9e0da] bg-white px-3.5 py-3 text-[15px] text-[#1f2a26] placeholder:text-[#9aa59f] shadow-sm transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20 disabled:bg-[#f4f6f5] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff]';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await djangoPasswordResetRequest(trimmed);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter the email on your account and we will send a reset link."
    >
      <Card className="border-[#e4ebe6] !bg-white !shadow-[0_18px_50px_rgba(31,49,42,0.08)]">
        <CardContent className="px-6 py-7 sm:px-8">
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#3d4d46]">
                If an account exists for <strong>{email.trim().toLowerCase()}</strong>, we
                sent a reset link. It expires in 24 hours.
              </p>
              <Link to="/login" className="inline-flex text-sm font-semibold text-anixi-green hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-[#3d4d46]">
                  Email address
                </label>
                <input
                  id="reset-email"
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
                {isLoading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
          <div className="mt-6 border-t border-[#eef2ef] pt-5">
            <SignInPrompt />
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
