import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { usePartnerListing } from '../../components/PartnerLayout';
import { PartnerFlash } from '../../components/partner/partnerUi';
import { useAuth } from '../../hooks/AuthContext';

export const PartnerAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { listing } = usePartnerListing();
  const [signingOut, setSigningOut] = useState(false);
  const [flash, setFlash] = useState('');

  const onSignOut = async () => {
    setSigningOut(true);
    setFlash('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Could not sign out');
      setSigningOut(false);
    }
  };

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Account"
        description="Sign-in details for this Market Partner workspace."
      />

      <PartnerFlash message={flash} tone="err" />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft sm:p-6">
          <h3 className="font-heading text-base font-bold text-[#1a4d4d]">Signed-in user</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">Name</dt>
              <dd className="mt-1 font-medium text-[#344256]">
                {user?.displayName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">Email</dt>
              <dd className="mt-1 font-medium text-[#344256]">{user?.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">Role</dt>
              <dd className="mt-1 font-medium text-[#344256]">Market Partner</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                Linked listing
              </dt>
              <dd className="mt-1 font-medium text-[#344256]">
                {listing?.businessName || '—'}
                {listing?.partnerType ? (
                  <span className="ml-2 capitalize text-[#65758b]">({listing.partnerType})</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3">
          <Link
            to="/change-password"
            className="flex items-center justify-between rounded-2xl border border-[#e1e7ef] bg-white px-5 py-4 shadow-soft transition hover:border-anixi-green/40"
          >
            <div className="flex items-center gap-3">
              <LockClosedIcon className="h-5 w-5 text-anixi-green" />
              <div>
                <p className="font-semibold text-[#1a4d4d]">Change password</p>
                <p className="text-sm text-[#65758b]">Update the password for this account</p>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={signingOut}
            className="flex w-full items-center justify-between rounded-2xl border border-[#e1e7ef] bg-white px-5 py-4 text-left shadow-soft transition hover:border-red-200 disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-[#1a4d4d]">
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </p>
                <p className="text-sm text-[#65758b]">End this session on this device</p>
              </div>
            </div>
          </button>

          <div className="rounded-2xl border border-[#e1e7ef] bg-[#f7faf8] px-5 py-4 text-sm text-[#65758b]">
            <p className="font-semibold text-[#344256]">Need help?</p>
            <p className="mt-1">
              Listing and verification questions:{' '}
              <a
                href="mailto:info@anixihealth.com"
                className="font-semibold text-anixi-green hover:underline"
              >
                info@anixihealth.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  );
};
