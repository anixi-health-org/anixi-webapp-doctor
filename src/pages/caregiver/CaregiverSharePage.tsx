import React, { useState } from 'react';
import { Check, Copy, Smartphone } from 'lucide-react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { Card, CardContent } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';

const IOS_APP_LINK = 'https://apps.apple.com/app/anixi-health';
const ANDROID_APP_LINK = 'https://play.google.com/store/apps/details?id=com.anixi.health';
const PATIENT_SIGNUP = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?role=patient`;

export const CaregiverSharePage: React.FC = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const inviteMessage = `Join me on Anixi Health - a platform that helps families and caregivers stay connected to patient health.\n\nPatient sign-up: ${PATIENT_SIGNUP}\n\nDownload the app:\niOS: ${IOS_APP_LINK}\nAndroid: ${ANDROID_APP_LINK}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Share Anixi"
        description="Invite patients, families, and fellow caregivers to join the Anixi Health community."
      />

      <Card className="mb-6">
        <CardContent className="space-y-4 p-6">
          <h2 className="font-heading text-lg font-semibold text-gray-900">Invite message</h2>
          <p className="whitespace-pre-line rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
            {inviteMessage}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy invite message'}
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-anixi-green/10">
              <Smartphone className="h-5 w-5 text-anixi-green" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-gray-900">Download links</h3>
              <p className="text-sm text-gray-500">Share with {user?.displayName || 'your network'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={IOS_APP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              App Store
            </a>
            <a
              href={ANDROID_APP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-anixi-green px-5 py-2.5 text-sm font-semibold text-anixi-green hover:bg-anixi-green/5"
            >
              Google Play
            </a>
            <a
              href={PATIENT_SIGNUP}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Patient web sign-up
            </a>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
};
