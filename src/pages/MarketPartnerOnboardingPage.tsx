import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BuildingStorefrontIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { OnboardingShell } from '../components/onboarding/OnboardingShell';
import { getOnboardingStepMeta } from '../components/onboarding/OnboardingProgress';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  PRACTICE_COUNTRIES,
  detectDefaultCountryCode,
} from '../constants/countries';
import { SA_PROVINCES } from '../lib/southAfrica';
import { djangoSubmitMarketplacePartnerApplication } from '../services/djangoApiService';
import { useAuth } from '../hooks/AuthContext';
import { PartnerOperatingHoursEditor } from '../components/partner/PartnerOperatingHoursEditor';

type PartnerType = 'wellness' | 'pharmacy';

type OfferingDraft = {
  id: string;
  name: string;
  description: string;
  price: string;
};

const WELLNESS_CATEGORIES = [
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'mental_health', label: 'Mental health' },
  { value: 'meal_plan', label: 'Meal plans' },
  { value: 'home_care', label: 'Home care' },
  { value: 'other', label: 'Other wellness' },
] as const;

const inputClass =
  'mt-1.5 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256] placeholder:text-[#94a3b8] focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green';

const labelClass = 'block text-sm font-medium text-[#344256]';

function newOffering(): OfferingDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    description: '',
    price: '',
  };
}

export const MarketPartnerOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);

  const [partnerType, setPartnerType] = useState<PartnerType>('wellness');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('nutrition');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [operatingHours, setOperatingHours] = useState('');

  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(() => detectDefaultCountryCode());
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);

  const [offerings, setOfferings] = useState<OfferingDraft[]>([newOffering()]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const stepMeta = getOnboardingStepMeta('market_partner', step);
  const isSouthAfrica = country === 'ZA';

  const filledOfferings = useMemo(
    () =>
      offerings
        .map((item) => ({
          name: item.name.trim(),
          description: item.description.trim(),
          price: item.price.trim() || null,
        }))
        .filter((item) => item.name),
    [offerings],
  );

  const categoryLabel =
    WELLNESS_CATEGORIES.find((c) => c.value === category)?.label || category;

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      if (!businessName.trim()) return 'Business name is required';
      if (!tagline.trim()) return 'Add a short tagline patients will see';
      if (!description.trim() || description.trim().length < 40) {
        return 'Add a description of at least 40 characters';
      }
      if (partnerType === 'pharmacy' && !registrationNumber.trim()) {
        return 'Pharmacy licence / registration number is required';
      }
      return null;
    }
    if (current === 2) {
      if (!email.trim()) return 'Contact email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return 'Enter a valid contact email';
      }
      if (!phone.trim()) return 'Phone number is required';
      if (!city.trim()) return 'City is required';
      if (!province.trim()) return 'Province / region is required';
      if (!address.trim()) return 'Street address is required';
      return null;
    }
    if (current === 3) {
      if (filledOfferings.length === 0) {
        return 'Add at least one product or service';
      }
      return null;
    }
    return null;
  };

  const goNext = () => {
    setError('');
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => {
    setError('');
    if (step > 1) setStep((s) => s - 1);
  };

  const updateOffering = (id: string, patch: Partial<OfferingDraft>) => {
    setOfferings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const removeOffering = (id: string) => {
    setOfferings((prev) => (prev.length <= 1 ? prev : prev.filter((o) => o.id !== id)));
  };

  const handleSubmit = async () => {
    setError('');
    for (const s of [1, 2, 3]) {
      const validationError = validateStep(s);
      if (validationError) {
        setError(validationError);
        setStep(s);
        return;
      }
    }
    setIsLoading(true);
    try {
      await djangoSubmitMarketplacePartnerApplication({
        partnerType,
        businessName: businessName.trim(),
        category: partnerType === 'wellness' ? category : '',
        tagline: tagline.trim(),
        description: description.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        province: province.trim(),
        address: address.trim(),
        deliveryAvailable: partnerType === 'pharmacy' ? deliveryAvailable : false,
        website: website.trim(),
        registrationNumber: registrationNumber.trim(),
        operatingHours: operatingHours.trim(),
        country,
        offerings: filledOfferings,
      });
      await refreshUser();
      navigate('/market-partner/review', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OnboardingShell
      flow="market_partner"
      currentStep={step}
      title={stepMeta.title}
      subtitle={stepMeta.subtitle}
      maxWidth="2xl"
      onBack={step > 1 ? goBack : undefined}
      backLabel="Previous step"
      onStepClick={(_, stepNumber) => {
        if (stepNumber < step) {
          setError('');
          setStep(stepNumber);
        }
      }}
    >
      <Card className="!border-[#e1e7ef] !bg-white !shadow-sm">
        <CardHeader className="border-b border-[#eef2f6] pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-[#344256]">
            <BuildingStorefrontIcon className="h-5 w-5 text-anixi-green" aria-hidden />
            {step === 1 && 'Business profile'}
            {step === 2 && 'Location & contact'}
            {step === 3 && 'Market offerings'}
            {step === 4 && 'Application summary'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {step === 1 && (
            <>
              <div>
                <p className={labelClass}>Partner type</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      [
                        'wellness',
                        'Wellness provider',
                        'Nutrition, fitness, mental health, and more',
                      ],
                      ['pharmacy', 'Pharmacy', 'Medicines, scripts, and delivery'],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPartnerType(value)}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                        partnerType === value
                          ? 'border-anixi-green bg-anixi-green/[0.04] text-anixi-green'
                          : 'border-[#e1e7ef] text-[#344256] hover:border-[#c5d4cd]'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-0.5 block text-xs font-normal text-[#65758b]">
                        {hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className={labelClass}>Business name</span>
                <input
                  className={inputClass}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Green Bowl Nutrition"
                  required
                />
              </label>

              {partnerType === 'wellness' ? (
                <label className="block">
                  <span className={labelClass}>Category</span>
                  <select
                    className={inputClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {WELLNESS_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className={labelClass}>Tagline</span>
                <input
                  className={inputClass}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Short line patients will see on the Market"
                  maxLength={120}
                />
              </label>

              <label className="block">
                <span className={labelClass}>About your business</span>
                <textarea
                  className={`${inputClass} min-h-[120px]`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe who you serve, what you offer, and why patients should choose you."
                />
                <span className="mt-1 block text-xs text-[#94a3b8]">
                  {description.trim().length}/40 characters minimum
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Website (optional)</span>
                  <input
                    className={inputClass}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                    type="url"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>
                    {partnerType === 'pharmacy'
                      ? 'Pharmacy licence / registration no.'
                      : 'Business registration no. (optional)'}
                  </span>
                  <input
                    className={inputClass}
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder={
                      partnerType === 'pharmacy' ? 'Licence number' : 'CIPC / reg. number'
                    }
                  />
                </label>
              </div>

              <div>
                <PartnerOperatingHoursEditor
                  value={operatingHours}
                  onChange={setOperatingHours}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Contact email</span>
                  <input
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Phone</span>
                  <input
                    className={inputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+27 …"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Country</span>
                <select
                  className={inputClass}
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    if (e.target.value !== 'ZA') setProvince('');
                  }}
                >
                  {PRACTICE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClass}>Street address</span>
                <input
                  className={inputClass}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Building, street, suburb"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>City</span>
                  <input
                    className={inputClass}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>
                    {isSouthAfrica ? 'Province' : 'Province / region'}
                  </span>
                  {isSouthAfrica ? (
                    <select
                      className={inputClass}
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      required
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
                      className={inputClass}
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      required
                    />
                  )}
                </label>
              </div>

              {partnerType === 'pharmacy' ? (
                <label className="flex items-start gap-3 rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-4 py-3 text-sm text-[#344256]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-anixi-green focus:ring-anixi-green"
                    checked={deliveryAvailable}
                    onChange={(e) => setDeliveryAvailable(e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">Delivery available</span>
                    <span className="mt-0.5 block text-xs text-[#65758b]">
                      Patients will see that you can deliver medicines or scripts.
                    </span>
                  </span>
                </label>
              ) : null}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-[#65758b]">
                Add each product or service you want patients to see. You can edit these later
                after approval.
              </p>
              <div className="space-y-3">
                {offerings.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#e1e7ef] bg-[#fafcfb] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                        Offering {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeOffering(item.id)}
                        disabled={offerings.length <= 1}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </button>
                    </div>
                    <div className="space-y-3">
                      <label className="block">
                        <span className={labelClass}>Name</span>
                        <input
                          className={inputClass}
                          value={item.name}
                          onChange={(e) => updateOffering(item.id, { name: e.target.value })}
                          placeholder={
                            partnerType === 'pharmacy'
                              ? 'e.g. Script collection'
                              : 'e.g. Nutrition consult'
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={labelClass}>Description (optional)</span>
                        <textarea
                          className={`${inputClass} min-h-[72px]`}
                          value={item.description}
                          onChange={(e) =>
                            updateOffering(item.id, { description: e.target.value })
                          }
                          placeholder="What patients get"
                        />
                      </label>
                      <label className="block sm:max-w-xs">
                        <span className={labelClass}>Price (optional)</span>
                        <input
                          className={inputClass}
                          value={item.price}
                          onChange={(e) => updateOffering(item.id, { price: e.target.value })}
                          placeholder="e.g. R450 / session"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOfferings((prev) => [...prev, newOffering()])}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-anixi-green/40 bg-anixi-green/[0.03] px-4 py-2.5 text-sm font-semibold text-anixi-green hover:bg-anixi-green/[0.06]"
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Add another offering
              </button>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4 text-sm text-[#344256]">
              <div className="rounded-xl border border-[#e1e7ef] bg-[#fafcfb] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Business
                </p>
                <p className="mt-1 text-base font-semibold">{businessName}</p>
                <p className="mt-0.5 text-[#65758b]">
                  {partnerType === 'wellness' ? `Wellness · ${categoryLabel}` : 'Pharmacy'}
                  {tagline ? ` · ${tagline}` : ''}
                </p>
                <p className="mt-3 leading-relaxed text-[#65758b]">{description}</p>
                {(website || registrationNumber || operatingHours) && (
                  <ul className="mt-3 space-y-1 text-[#65758b]">
                    {website ? <li>Website: {website}</li> : null}
                    {registrationNumber ? <li>Registration: {registrationNumber}</li> : null}
                    {operatingHours ? <li>Hours: {operatingHours}</li> : null}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[#e1e7ef] bg-[#fafcfb] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Location & contact
                </p>
                <p className="mt-2">{address}</p>
                <p>
                  {city}, {province}
                  {country ? ` · ${country}` : ''}
                </p>
                <p className="mt-2">
                  {email}
                  {phone ? ` · ${phone}` : ''}
                </p>
                {partnerType === 'pharmacy' ? (
                  <p className="mt-1 text-[#65758b]">
                    Delivery: {deliveryAvailable ? 'Available' : 'Not offered'}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-[#e1e7ef] bg-[#fafcfb] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Offerings ({filledOfferings.length})
                </p>
                <ul className="mt-2 divide-y divide-[#eef2f6]">
                  {filledOfferings.map((item) => (
                    <li key={item.name} className="py-2">
                      <p className="font-semibold">
                        {item.name}
                        {item.price ? (
                          <span className="ml-2 font-medium text-anixi-green">{item.price}</span>
                        ) : null}
                      </p>
                      {item.description ? (
                        <p className="mt-0.5 text-[#65758b]">{item.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="rounded-xl border border-anixi-green/20 bg-anixi-green/[0.04] px-4 py-3 text-[#344256]">
                After you submit, Anixi admin reviews your application. Approved listings appear
                on the patient Market tab.
              </p>
            </div>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[#eef2f6] pt-5 sm:flex-row sm:justify-end">
            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                className="w-full rounded-xl bg-anixi-green px-5 py-3 text-sm font-semibold text-white hover:opacity-95 sm:w-auto sm:min-w-[160px]"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void handleSubmit()}
                className="w-full rounded-xl bg-anixi-green px-5 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
              >
                {isLoading ? 'Submitting…' : 'Submit for admin approval'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </OnboardingShell>
  );
};
