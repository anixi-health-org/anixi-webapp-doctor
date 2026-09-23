import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  EyeSlashIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { usePartnerListing } from '../../components/PartnerLayout';
import {
  listingCompleteness,
  PartnerFlash,
  PartnerMarketPreview,
} from '../../components/partner/partnerUi';
import { useAuth } from '../../hooks/AuthContext';
import {
  djangoGetPartnerOrders,
  type PartnerOrder,
} from '../../services/djangoApiService';

export const PartnerOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const { listing, loading, error, save, refresh } = usePartnerListing();
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'ok' | 'err' | 'info'>('info');
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const completeness = useMemo(
    () => (listing ? listingCompleteness(listing) : null),
    [listing],
  );

  useEffect(() => {
    if (!listing || listing.partnerType !== 'pharmacy') return;
    let cancelled = false;
    setOrdersLoading(true);
    void djangoGetPartnerOrders()
      .then((rows) => {
        if (!cancelled) setOrders(rows);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listing?.partnerType, listing?.listingId]);

  const openOrders = orders.filter(
    (o) => !['dispensed', 'cancelled'].includes(String(o.status || '').toLowerCase()),
  ).length;

  const togglePublished = async () => {
    if (!listing || toggling) return;
    setToggling(true);
    setToast('');
    try {
      const next = !listing.published;
      await save({ published: next });
      setToastTone('ok');
      setToast(next ? 'Listing is live on the patient Market.' : 'Listing hidden from Market.');
      await refresh();
    } catch (err) {
      setToastTone('err');
      setToast(err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-[#dfe6e1]" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-28 rounded-2xl bg-[#dfe6e1]" />
            <div className="h-28 rounded-2xl bg-[#dfe6e1]" />
            <div className="h-28 rounded-2xl bg-[#dfe6e1]" />
          </div>
          <div className="h-64 rounded-2xl bg-[#dfe6e1]" />
        </div>
      </PageShell>
    );
  }

  if (error || !listing || !completeness) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <PageHeader title="Overview" description={error || 'Listing unavailable'} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          listing.published
            ? 'Your business is visible to patients in the Anixi Market. Keep the listing and offerings current.'
            : 'Your listing is hidden. Finish the checklist and publish when you are ready.'
        }
        badge={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              listing.published
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-900'
            }`}
          >
            {listing.published ? (
              <CheckBadgeIcon className="h-3.5 w-3.5" />
            ) : (
              <EyeSlashIcon className="h-3.5 w-3.5" />
            )}
            {listing.published ? 'Live on Market' : 'Hidden'}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => void togglePublished()}
            disabled={toggling}
            className="inline-flex items-center gap-2 rounded-full bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {listing.published ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
            {toggling ? 'Updating…' : listing.published ? 'Hide from Market' : 'Publish to Market'}
          </button>
        }
      />

      <PartnerFlash message={toast} tone={toastTone} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
            Profile strength
          </p>
          <p className="mt-2 font-heading text-3xl font-bold text-[#1a4d4d]">
            {completeness.score}%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2ef]">
            <div
              className="h-full rounded-full bg-anixi-green transition-all"
              style={{ width: `${completeness.score}%` }}
            />
          </div>
        </article>
        <article className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">Offerings</p>
          <p className="mt-2 font-heading text-3xl font-bold text-[#1a4d4d]">
            {listing.offerings?.length ?? 0}
          </p>
          <p className="mt-1 text-sm text-[#65758b]">Products or services listed</p>
        </article>
        <article className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
            Partner type
          </p>
          <p className="mt-2 font-heading text-xl font-bold capitalize text-[#1a4d4d]">
            {listing.partnerType}
          </p>
          <p className="mt-1 text-sm text-[#65758b]">
            {listing.verified ? 'Verified by Anixi' : 'Verification badge pending'}
          </p>
        </article>
        {listing.partnerType === 'pharmacy' ? (
          <article className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
              Open orders
            </p>
            <p className="mt-2 font-heading text-3xl font-bold text-[#1a4d4d]">
              {ordersLoading ? '—' : openOrders}
            </p>
            <Link
              to="/partner/orders"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-anixi-green hover:underline"
            >
              View inbox
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </article>
        ) : (
          <article className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">Location</p>
            <p className="mt-2 font-heading text-lg font-bold text-[#1a4d4d]">
              {[listing.city, listing.province].filter(Boolean).join(', ') || 'Add location'}
            </p>
            <p className="mt-1 text-sm text-[#65758b]">{listing.email || 'No contact email'}</p>
          </article>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {completeness.items.some((item) => !item.done) ? (
            <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-lg font-bold text-[#1a4d4d]">Listing checklist</h3>
                <span className="text-sm text-[#65758b]">
                  {completeness.items.filter((i) => i.done).length}/{completeness.items.length} done
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {completeness.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#eef2ef] px-3.5 py-3 transition hover:border-anixi-green/30 hover:bg-[#f7faf8]"
                    >
                      <span className="flex items-center gap-3 text-sm text-[#344256]">
                        <CheckCircleIcon
                          className={`h-5 w-5 shrink-0 ${
                            item.done ? 'text-emerald-600' : 'text-[#d0d7d3]'
                          }`}
                        />
                        {item.label}
                      </span>
                      {!item.done ? (
                        <span className="text-xs font-semibold text-anixi-green">Fix</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/partner/listing"
              className="group flex items-center justify-between rounded-2xl border border-[#e1e7ef] bg-white px-5 py-4 shadow-soft transition hover:border-anixi-green/40"
            >
              <div>
                <p className="font-semibold text-[#1a4d4d]">Edit listing profile</p>
                <p className="mt-0.5 text-sm text-[#65758b]">Name, contact, location, hours</p>
              </div>
              <ArrowRightIcon className="h-5 w-5 text-anixi-green transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/partner/offerings"
              className="group flex items-center justify-between rounded-2xl border border-[#e1e7ef] bg-white px-5 py-4 shadow-soft transition hover:border-anixi-green/40"
            >
              <div className="flex items-start gap-3">
                <ShoppingBagIcon className="mt-0.5 h-5 w-5 text-anixi-green" />
                <div>
                  <p className="font-semibold text-[#1a4d4d]">Manage offerings</p>
                  <p className="mt-0.5 text-sm text-[#65758b]">Products, services, and prices</p>
                </div>
              </div>
              <ArrowRightIcon className="h-5 w-5 text-anixi-green transition group-hover:translate-x-0.5" />
            </Link>
            {listing.partnerType === 'pharmacy' ? (
              <Link
                to="/partner/orders"
                className="group flex items-center justify-between rounded-2xl border border-[#e1e7ef] bg-white px-5 py-4 shadow-soft transition hover:border-anixi-green/40 sm:col-span-2"
              >
                <div className="flex items-start gap-3">
                  <ClipboardDocumentListIcon className="mt-0.5 h-5 w-5 text-anixi-green" />
                  <div>
                    <p className="font-semibold text-[#1a4d4d]">Prescription orders</p>
                    <p className="mt-0.5 text-sm text-[#65758b]">
                      Scripts clinicians send to your pharmacy
                    </p>
                  </div>
                </div>
                <ArrowRightIcon className="h-5 w-5 text-anixi-green transition group-hover:translate-x-0.5" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-2">
          <PartnerMarketPreview listing={listing} />
          <p className="mt-3 text-xs leading-relaxed text-[#65758b]">
            This is how patients see you in the Anixi mobile App. Edits to listing and
            offerings update this preview immediately after you save.
          </p>
        </div>
      </div>
    </PageShell>
  );
};
