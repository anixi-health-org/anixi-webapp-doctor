import React, { useEffect, useState } from 'react';
import { Check, Copy, Mail, Share2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, PageShell } from '../components/page-layout';
import { Card, CardContent } from '../components/ui/Card';
import { getDoctorReferral, getReferralStats, logInvitation } from '../services/referralService';

export const ShareAnixi: React.FC = () => {
  const { user } = useAuth();
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({ sent: 0, accepted: 0 });
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const referral = await getDoctorReferral(user.id);
        if (referral?.referralLink) {
          setReferralLink(referral.referralLink);
        }
        const referralStats = await getReferralStats(user.id);
        setStats(referralStats);
      } catch {
        setError('Could not load your referral link. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      if (user?.id) {
        await logInvitation(user.id, undefined, 'link');
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy link to clipboard.');
    }
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !inviteEmail.trim()) return;

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      await logInvitation(user.id, inviteEmail.trim(), 'email');
      const referralStats = await getReferralStats(user.id);
      setStats(referralStats);
      setInviteEmail('');
      setMessage(`Invitation logged for ${inviteEmail.trim()}. Share your link with them directly.`);
    } catch {
      setError('Failed to log invitation. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <p className="text-gray-500">Loading referral details...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Share Anixi"
        description="Invite colleagues and patients to join the Anixi Health platform."
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Invitations sent</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Invitations accepted</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.accepted}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-anixi-green" />
            <h2 className="font-heading text-lg font-semibold text-gray-900">Your referral link</h2>
          </div>
          <p className="text-sm text-gray-600">
            Share this link so patients can register on the web or download the mobile app.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={referralLink}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={!referralLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-anixi-green px-4 py-2.5 text-sm font-medium text-white hover:bg-anixi-green/90 disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-anixi-green" />
            <h2 className="font-heading text-lg font-semibold text-gray-900">Invite by email</h2>
          </div>
          <form onSubmit={handleEmailInvite} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/15"
              required
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-anixi-green px-4 py-2.5 text-sm font-medium text-white hover:bg-anixi-green/90 disabled:opacity-50"
            >
              {sending ? 'Saving...' : 'Log invite'}
            </button>
          </form>
          <p className="text-xs text-gray-500">
            We track invitations here. Copy your link and send it to them directly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-heading text-lg font-semibold text-gray-900 mb-4">Download Anixi Health App</h3>
          <p className="text-gray-600 mb-4 text-sm">Share the mobile app with your patients and colleagues.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="https://apps.apple.com/app/anixi-health"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-lg hover:shadow-lg transition-shadow flex items-center justify-center space-x-3"
            >
              <div className="text-left">
                <p className="text-xs opacity-75">Download for</p>
                <p className="text-lg font-semibold">iOS</p>
              </div>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.anixi.health"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg transition-shadow flex items-center justify-center space-x-3"
            >
              <div className="text-left">
                <p className="text-xs opacity-75">Download for</p>
                <p className="text-lg font-semibold">Android</p>
          </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default ShareAnixi;
