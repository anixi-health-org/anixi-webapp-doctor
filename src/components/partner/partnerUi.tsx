import clsx from 'clsx';
import React from 'react';
import {
  BuildingStorefrontIcon,
  CheckBadgeIcon,
  MapPinIcon,
  PhoneIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import type { PartnerListing } from '../../services/djangoApiService';

export const partnerFieldClass =
  'mt-1.5 block w-full rounded-xl border border-[#d9e0da] bg-white px-3.5 py-2.5 text-[15px] text-[#1f2a26] shadow-sm transition focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20 disabled:bg-[#f4f6f5]';

export const partnerLabelClass = 'block text-sm font-medium text-[#344256]';

export const partnerHelpClass = 'mt-1 text-xs text-[#65758b]';

export const WELLNESS_CATEGORIES = [
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'mental_health', label: 'Mental health' },
  { value: 'meal_plan', label: 'Meal plans' },
  { value: 'home_care', label: 'Home care' },
  { value: 'other', label: 'Other wellness' },
] as const;

export function wellnessCategoryLabel(value?: string | null): string {
  if (!value) return 'Wellness';
  return WELLNESS_CATEGORIES.find((c) => c.value === value)?.label || value;
}

export type CompletenessItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export function listingCompleteness(listing: PartnerListing): {
  score: number;
  items: CompletenessItem[];
} {
  const items: CompletenessItem[] = [
    {
      id: 'name',
      label: 'Business name',
      done: Boolean(listing.businessName?.trim()),
      href: '/partner/listing',
    },
    {
      id: 'tagline',
      label: 'Tagline patients notice',
      done: Boolean(listing.tagline?.trim()),
      href: '/partner/listing',
    },
    {
      id: 'description',
      label: 'Description (40+ characters)',
      done: (listing.description || '').trim().length >= 40,
      href: '/partner/listing',
    },
    {
      id: 'contact',
      label: 'Email and phone',
      done: Boolean(listing.email?.trim() && listing.phone?.trim()),
      href: '/partner/listing',
    },
    {
      id: 'location',
      label: 'City, province, and address',
      done: Boolean(
        listing.city?.trim() && listing.province?.trim() && listing.address?.trim(),
      ),
      href: '/partner/listing',
    },
    {
      id: 'hours',
      label: 'Operating hours',
      done: Boolean(listing.operatingHours?.trim()),
      href: '/partner/listing#operating-hours',
    },
    {
      id: 'licence',
      label: 'Licence / registration number',
      done: Boolean(listing.registrationNumber?.trim()),
      href: '/partner/listing',
    },
    {
      id: 'offerings',
      label: 'At least one offering',
      done: (listing.offerings?.length ?? 0) > 0,
      href: '/partner/offerings',
    },
    {
      id: 'published',
      label: 'Published on Market',
      done: Boolean(listing.published),
      href: '/partner',
    },
  ];
  if (listing.partnerType === 'wellness') {
    items.splice(2, 0, {
      id: 'category',
      label: 'Wellness category',
      done: Boolean(listing.category?.trim()),
      href: '/partner/listing',
    });
  }
  const done = items.filter((i) => i.done).length;
  return { score: Math.round((done / items.length) * 100), items };
}

/** Mobile Market card preview — mirrors patient app listing card. */
export const PartnerMarketPreview: React.FC<{
  listing: PartnerListing;
  className?: string;
}> = ({ listing, className }) => {
  const location = [listing.city, listing.province].filter(Boolean).join(', ');
  const subtitle =
    listing.partnerType === 'pharmacy'
      ? listing.tagline || listing.address || 'Pharmacy partner'
      : listing.tagline || wellnessCategoryLabel(listing.category);

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border border-[#e1e7ef] bg-[#f4f7f5] p-4',
        className,
      )}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
        Patient Market preview
      </p>
      <div className="rounded-2xl border border-[#dfe6e1] bg-white p-4 shadow-soft">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ec] text-anixi-green">
            <BuildingStorefrontIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-heading text-base font-bold text-[#1a4d4d]">
                {listing.businessName || 'Your business'}
              </h3>
              {listing.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  <CheckBadgeIcon className="h-3 w-3" />
                  Verified
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-[#65758b]">{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#65758b]">
              {location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {location}
                </span>
              ) : null}
              {listing.phone ? (
                <span className="inline-flex items-center gap-1">
                  <PhoneIcon className="h-3.5 w-3.5" />
                  {listing.phone}
                </span>
              ) : null}
              {listing.partnerType === 'pharmacy' && listing.deliveryAvailable ? (
                <span className="inline-flex items-center gap-1 text-anixi-teal">
                  <TruckIcon className="h-3.5 w-3.5" />
                  Delivery
                </span>
              ) : null}
              {listing.operatingHours?.trim() ? (
                <span className="inline-flex items-center gap-1">
                  Hours: {listing.operatingHours.trim()}
                </span>
              ) : null}
            </div>
            {!listing.published ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                Hidden — patients will not see this listing until you publish.
              </p>
            ) : null}
          </div>
        </div>
        {listing.offerings?.length ? (
          <div className="mt-4 border-t border-[#eef2ef] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">
              Offerings
            </p>
            <ul className="mt-2 space-y-1.5">
              {listing.offerings.slice(0, 4).map((o) => (
                <li
                  key={o.name}
                  className="flex items-start justify-between gap-3 text-sm text-[#344256]"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{o.name}</span>
                    {o.description ? (
                      <span className="mt-0.5 block text-xs text-[#65758b] line-clamp-1">
                        {o.description}
                      </span>
                    ) : null}
                  </span>
                  {o.price ? (
                    <span className="shrink-0 font-semibold text-anixi-green">{o.price}</span>
                  ) : null}
                </li>
              ))}
              {listing.offerings.length > 4 ? (
                <li className="text-xs text-[#65758b]">
                  +{listing.offerings.length - 4} more
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const PartnerFlash: React.FC<{
  message: string;
  tone?: 'ok' | 'err' | 'info';
}> = ({ message, tone = 'info' }) => {
  if (!message) return null;
  const styles =
    tone === 'ok'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
      : tone === 'err'
        ? 'border-red-100 bg-red-50 text-red-800'
        : 'border-[#dfe6e1] bg-white text-[#344256]';
  return <p className={clsx('mb-5 rounded-xl border px-4 py-3 text-sm', styles)}>{message}</p>;
};

export const ORDER_STATUS_OPTIONS = [
  { value: 'sent', label: 'Sent', hint: 'New script from a clinician' },
  { value: 'received', label: 'Received', hint: 'Acknowledged by pharmacy' },
  { value: 'preparing', label: 'Preparing', hint: 'Being dispensed' },
  { value: 'ready', label: 'Ready', hint: 'Ready for collection / delivery' },
  { value: 'dispensed', label: 'Dispensed', hint: 'Completed' },
  { value: 'cancelled', label: 'Cancelled', hint: 'Cancelled or declined' },
] as const;

export function orderStatusLabel(status?: string | null): string {
  const value = (status || 'sent').toLowerCase();
  return ORDER_STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
}

export function orderStatusClasses(status?: string | null): string {
  switch ((status || 'sent').toLowerCase()) {
    case 'received':
      return 'bg-sky-50 text-sky-800';
    case 'preparing':
      return 'bg-amber-50 text-amber-900';
    case 'ready':
      return 'bg-violet-50 text-violet-800';
    case 'dispensed':
      return 'bg-emerald-50 text-emerald-800';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-anixi-beige text-[#425950]';
  }
}
