import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Link2, UserCheck } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { SignInPrompt } from '../components/auth/AuthLinks';
import { getJoinPathConfig } from '../lib/joinPathConfig';

const STEPS = [
  {
    Icon: Mail,
    title: 'Check your inbox',
    description: 'Your clinic sent an invitation to your work email with a secure join link.',
  },
  {
    Icon: Link2,
    title: 'Open the invite link',
    description: 'Tap the button in the email — it includes your practice, role, and access token.',
  },
  {
    Icon: UserCheck,
    title: 'Create account or sign in',
    description: 'Use the invited email address, then access the portal for your role.',
  },
];

function parseInviteUrl(raw: string): { practiceId: string; inviteId: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(trimmed, window.location.origin);
    const practiceId = url.searchParams.get('practiceId') || '';
    const inviteId = url.searchParams.get('inviteId') || '';
    const token = url.searchParams.get('token') || '';
    if (practiceId && inviteId && token) {
      return { practiceId, inviteId, token };
    }
  } catch {
    return null;
  }
  return null;
}

export const JoinInviteLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const config = getJoinPathConfig('invite');
  const [inviteUrl, setInviteUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleOpenLink = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError('');
    const parsed = parseInviteUrl(inviteUrl);
    if (!parsed) {
      setUrlError('Paste the full invite URL from your clinic email.');
      return;
    }
    const qs = new URLSearchParams(parsed).toString();
    navigate(`/join/invite?${qs}`);
  };

  return (
    <AuthLayout
      title="Join with an invitation"
      subtitle="Clinic staff and invited doctors should use the link from their email"
      maxWidth="xl"
      compact
      heroSlides={config.heroSlides}
    >
      <div className="rounded-2xl border border-gray-100 bg-white px-5 py-6 shadow-lg sm:px-7 sm:py-7">
        <div className="space-y-4">
          {STEPS.map(({ Icon, title, description }, index) => (
            <div key={title} className="flex gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-anixi-green/10 text-anixi-green">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {index + 1}. {title}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-gray-500">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <form className="mt-6 space-y-3 border-t border-[#eef2ef] pt-6" onSubmit={handleOpenLink}>
          <label htmlFor="inviteUrl" className="block text-sm font-medium text-gray-700">
            Already have your invite link?
          </label>
          <input
            id="inviteUrl"
            type="url"
            value={inviteUrl}
            onChange={(e) => setInviteUrl(e.target.value)}
            placeholder="Paste invite URL from email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
          />
          {urlError ? <p className="text-sm text-red-600">{urlError}</p> : null}
          <button
            type="submit"
            className="w-full rounded-full bg-anixi-green py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Open invitation
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SignInPrompt />
          <Link to="/join" className="text-center text-sm font-medium text-anixi-green hover:underline sm:text-right">
            Choose a different path
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default JoinInviteLandingPage;
