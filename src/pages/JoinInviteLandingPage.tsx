import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { SignInPrompt } from '../components/auth/AuthLinks';
import { getJoinPathConfig } from '../lib/joinPathConfig';

const STEPS = [
  {
    Icon: Mail,
    title: 'Open the invite email',
    description:
      'When a clinic or practice adds you, Anixi sends an invitation from info@anixihealth.com.',
  },
  {
    Icon: KeyRound,
    title: 'Accept & create your password',
    description:
      'Tap Accept invite in the email, then choose a password for your Anixi account.',
  },
  {
    Icon: CheckCircle2,
    title: 'Join your practice',
    description: 'You’re signed in to the right clinic or private practice workspace for your role.',
  },
];

/** Shown when /join/invite is opened without email-link query params. */
export const JoinInviteLandingPage: React.FC = () => {
  const config = getJoinPathConfig('invite');

  return (
    <AuthLayout
      title="Check your invitation email"
      subtitle="Clinic and practice invites are sent by email — open the Accept invite link to continue"
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

        <div className="mt-6 rounded-xl border border-[#e8eeec] bg-[#fafcfb] px-4 py-3.5 text-sm text-[#344256]">
          <p className="font-medium">Didn’t get the email?</p>
          <p className="mt-1 text-[#65758b]">
            Check spam, confirm the address your clinic used, or ask them to resend the invitation
            from Team settings. Invites are sent from{' '}
            <span className="font-medium text-anixi-green">info@anixihealth.com</span>.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SignInPrompt />
          <Link
            to="/join"
            className="text-center text-sm font-medium text-anixi-green hover:underline sm:text-right"
          >
            Choose a different path
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default JoinInviteLandingPage;
