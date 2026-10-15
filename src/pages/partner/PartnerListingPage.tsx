import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRACTICE_COUNTRIES } from '../../constants/countries';
import { PageHeader, PageShell } from '../../components/page-layout';
import { usePartnerListing } from '../../components/PartnerLayout';
import {
  PartnerFlash,
  PartnerMarketPreview,
  WELLNESS_CATEGORIES,
  partnerFieldClass,
  partnerHelpClass,
  partnerLabelClass,
} from '../../components/partner/partnerUi';
import { PartnerOperatingHoursEditor } from '../../components/partner/PartnerOperatingHoursEditor';
import { SA_PROVINCES } from '../../lib/southAfrica';
import type { PartnerListing } from '../../services/djangoApiService';

type FormState = {
  businessName: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  address: string;
  website: string;
  registrationNumber: string;
  operatingHours: string;
  country: string;
  category: string;
  deliveryAvailable: boolean;
};

const emptyForm = (): FormState => ({
  businessName: '',
  tagline: '',
  description: '',
  email: '',
  phone: '',
  city: '',
  province: '',
  address: '',
  website: '',
  registrationNumber: '',
  operatingHours: '',
  country: 'ZA',
  category: 'nutrition',
  deliveryAvailable: false,
});

function fromListing(listing: PartnerListing): FormState {
  return {
    businessName: listing.businessName || '',
    tagline: listing.tagline || '',
    description: listing.description || '',
    email: listing.email || '',
    phone: listing.phone || '',
    city: listing.city || '',
    province: listing.province || '',
    address: listing.address || '',
    website: listing.website || '',
    registrationNumber: listing.registrationNumber || '',
    operatingHours: listing.operatingHours || '',
    country: listing.country || 'ZA',
    category: listing.category || 'nutrition',
    deliveryAvailable: Boolean(listing.deliveryAvailable),
  };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft sm:p-6">
      <div className="mb-4 border-b border-[#eef2ef] pb-3">
        <h3 className="font-heading text-base font-bold text-[#1a4d4d]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[#65758b]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export const PartnerListingPage: React.FC = () => {
  const { listing, loading, error, save } = usePartnerListing();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (listing) setForm(fromListing(listing));
  }, [listing]);

  useEffect(() => {
    if (loading || !listing) return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#operating-hours') return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById('operating-hours');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('operatingHours')?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loading, listing]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isSouthAfrica = form.country === 'ZA' || form.country === 'South Africa';

  const livePreview = useMemo((): PartnerListing | null => {
    if (!listing) return null;
    return {
      ...listing,
      businessName: form.businessName.trim() || listing.businessName,
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      address: form.address.trim(),
      website: form.website.trim(),
      registrationNumber: form.registrationNumber.trim(),
      operatingHours: form.operatingHours.trim(),
      country: form.country.trim(),
      category: form.category.trim(),
      deliveryAvailable: form.deliveryAvailable,
    };
  }, [listing, form]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.businessName.trim()) next.businessName = 'Business name is required';
    if (!form.tagline.trim()) next.tagline = 'Add a short tagline patients will notice';
    if (form.description.trim().length < 40) {
      next.description = 'Use at least 40 characters so patients understand what you offer';
    }
    if (!form.email.trim()) next.email = 'Contact email is required';
    if (!form.phone.trim()) next.phone = 'Phone number is required';
    if (!form.city.trim()) next.city = 'City is required';
    if (!form.province.trim()) next.province = 'Province / region is required';
    if (!form.address.trim()) next.address = 'Street address helps patients find you';
    if (listing?.partnerType === 'wellness' && !form.category.trim()) {
      next.category = 'Choose a wellness category';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || saving) return;
    if (!validate()) {
      setMessageType('err');
      setMessage('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await save({
        businessName: form.businessName.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        registrationNumber: form.registrationNumber.trim(),
        operatingHours: form.operatingHours.trim(),
        country: form.country.trim(),
        ...(listing.partnerType === 'wellness' ? { category: form.category.trim() } : {}),
        ...(listing.partnerType === 'pharmacy'
          ? { deliveryAvailable: form.deliveryAvailable }
          : {}),
      });
      setMessageType('ok');
      setMessage('Listing saved. Patients will see the updated profile on Market.');
    } catch (err) {
      setMessageType('err');
      setMessage(err instanceof Error ? err.message : 'Could not save listing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <div className="h-64 animate-pulse rounded-2xl bg-[#dfe6e1]" />
      </PageShell>
    );
  }

  if (error || !listing) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <PageHeader title="Listing" description={error || 'Unavailable'} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Listing profile"
        description="This is the business card patients open in the Anixi Market. Keep contact details and location accurate."
        actions={
          <Link
            to="/partner/offerings"
            className="text-sm font-semibold text-anixi-green hover:underline"
          >
            Manage offerings →
          </Link>
        }
      />

      <PartnerFlash message={message} tone={messageType} />

      <form onSubmit={(e) => void onSubmit(e)} className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Section
            title="Business identity"
            description="Name and story that appear at the top of your Market detail page."
          >
            <div className="grid gap-4">
              <div>
                <label className={partnerLabelClass} htmlFor="businessName">
                  Business name
                </label>
                <input
                  id="businessName"
                  className={partnerFieldClass}
                  value={form.businessName}
                  onChange={(e) => setField('businessName', e.target.value)}
                  required
                />
                {fieldErrors.businessName ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.businessName}</p>
                ) : null}
              </div>
              {listing.partnerType === 'wellness' ? (
                <div>
                  <label className={partnerLabelClass} htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    className={partnerFieldClass}
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                  >
                    {WELLNESS_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className={partnerLabelClass} htmlFor="tagline">
                  Tagline
                </label>
                <input
                  id="tagline"
                  className={partnerFieldClass}
                  value={form.tagline}
                  onChange={(e) => setField('tagline', e.target.value)}
                  maxLength={120}
                  placeholder="One short line patients will notice"
                />
                <p className={partnerHelpClass}>{form.tagline.length}/120</p>
                {fieldErrors.tagline ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.tagline}</p>
                ) : null}
              </div>
              <div>
                <label className={partnerLabelClass} htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  className={`${partnerFieldClass} min-h-[130px]`}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                />
                <p className={partnerHelpClass}>
                  {form.description.trim().length} characters · aim for 40+
                </p>
                {fieldErrors.description ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
                ) : null}
              </div>
              <div>
                <label className={partnerLabelClass} htmlFor="registrationNumber">
                  Licence / registration number
                </label>
                <input
                  id="registrationNumber"
                  className={partnerFieldClass}
                  value={form.registrationNumber}
                  onChange={(e) => setField('registrationNumber', e.target.value)}
                  placeholder={
                    listing.partnerType === 'pharmacy' ? 'Pharmacy licence' : 'Practice registration'
                  }
                />
              </div>
            </div>
          </Section>

          <Section
            title="Operating hours"
            description="When patients can collect, call, or request delivery."
          >
            <PartnerOperatingHoursEditor
              value={form.operatingHours}
              onChange={(next) => setField('operatingHours', next)}
            />
          </Section>

          <Section title="Contact" description="How patients and clinicians reach you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={partnerLabelClass} htmlFor="email">
                  Contact email
                </label>
                <input
                  id="email"
                  type="email"
                  className={partnerFieldClass}
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                ) : null}
              </div>
              <div>
                <label className={partnerLabelClass} htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  className={partnerFieldClass}
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+27…"
                />
                {fieldErrors.phone ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className={partnerLabelClass} htmlFor="website">
                  Website
                </label>
                <input
                  id="website"
                  className={partnerFieldClass}
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>
          </Section>

          <Section title="Location" description="Shown on Market cards and detail screens.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={partnerLabelClass} htmlFor="country">
                  Country
                </label>
                <select
                  id="country"
                  className={partnerFieldClass}
                  value={form.country}
                  onChange={(e) => setField('country', e.target.value)}
                >
                  {PRACTICE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={partnerLabelClass} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className={partnerFieldClass}
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                />
                {fieldErrors.city ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p>
                ) : null}
              </div>
              <div>
                <label className={partnerLabelClass} htmlFor="province">
                  Province / region
                </label>
                {isSouthAfrica ? (
                  <select
                    id="province"
                    className={partnerFieldClass}
                    value={form.province}
                    onChange={(e) => setField('province', e.target.value)}
                  >
                    <option value="">Select province</option>
                    {SA_PROVINCES.map((p) => (
                      <option key={p.value} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="province"
                    className={partnerFieldClass}
                    value={form.province}
                    onChange={(e) => setField('province', e.target.value)}
                  />
                )}
                {fieldErrors.province ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.province}</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className={partnerLabelClass} htmlFor="address">
                  Street address
                </label>
                <textarea
                  id="address"
                  className={`${partnerFieldClass} min-h-[80px]`}
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                />
                {fieldErrors.address ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>
                ) : null}
              </div>
              {listing.partnerType === 'pharmacy' ? (
                <div className="flex items-start gap-3 rounded-xl border border-[#eef2ef] bg-[#f7faf8] px-4 py-3 sm:col-span-2">
                  <input
                    id="deliveryAvailable"
                    type="checkbox"
                    checked={form.deliveryAvailable}
                    onChange={(e) => setField('deliveryAvailable', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#d9e0da] text-anixi-green focus:ring-anixi-green"
                  />
                  <label htmlFor="deliveryAvailable" className="text-sm text-[#344256]">
                    <span className="font-semibold">Delivery available</span>
                    <span className="mt-0.5 block text-[#65758b]">
                      Show a delivery badge on your Market card so patients know you can send scripts
                      or OTC items.
                    </span>
                  </label>
                </div>
              ) : null}
            </div>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#65758b]">
              Visibility is controlled from{' '}
              <Link to="/partner" className="font-semibold text-anixi-green hover:underline">
                Overview
              </Link>
              .
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save listing'}
            </button>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            {livePreview ? <PartnerMarketPreview listing={livePreview} /> : null}
            <div className="mt-4 rounded-2xl border border-[#e1e7ef] bg-white p-4 text-sm text-[#65758b] shadow-soft">
              <p className="font-semibold text-[#344256]">Tips for a strong listing</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Lead with outcomes patients care about in the tagline</li>
                <li>Include a reachable phone number for script queries</li>
                <li>Keep hours accurate for collection and delivery</li>
              </ul>
            </div>
          </div>
        </aside>
      </form>
    </PageShell>
  );
};
