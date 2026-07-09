import { getCurrencyForCountry } from '../constants/countries';

const LOCALE_BY_COUNTRY: Record<string, string> = {
  ZA: 'en-ZA',
  MA: 'fr-MA',
  US: 'en-US',
  GB: 'en-GB',
  CA: 'en-CA',
  AU: 'en-AU',
  NZ: 'en-NZ',
  FR: 'fr-FR',
  DE: 'de-DE',
  CH: 'de-CH',
  AE: 'ar-AE',
  SA: 'ar-SA',
  EG: 'ar-EG',
  NG: 'en-NG',
  KE: 'en-KE',
  GH: 'en-GH',
  IN: 'en-IN',
  BR: 'pt-BR',
  MX: 'es-MX',
  JP: 'ja-JP',
  CN: 'zh-CN',
};

const TIMEZONE_CURRENCY: Record<string, string> = {
  'Africa/Johannesburg': 'ZAR',
  'Africa/Casablanca': 'MAD',
  'Africa/Cairo': 'EGP',
  'Africa/Lagos': 'NGN',
  'Africa/Nairobi': 'KES',
  'Africa/Accra': 'GHS',
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Zurich': 'CHF',
  'America/New_York': 'USD',
  'America/Toronto': 'CAD',
  'Australia/Sydney': 'AUD',
  'Pacific/Auckland': 'NZD',
  'Asia/Dubai': 'AED',
  'Asia/Riyadh': 'SAR',
  'Asia/Kolkata': 'INR',
  'Asia/Tokyo': 'JPY',
  'Asia/Shanghai': 'CNY',
};

const NATIONALITY_CURRENCY: Record<string, string> = {
  'south african': 'ZAR',
  moroccan: 'MAD',
};

export type DoctorCurrencyContext = {
  currency?: string;
  country?: string;
  timezone?: string;
  nationality?: string;
};

export function resolveDoctorCurrency(ctx: DoctorCurrencyContext): string {
  if (ctx.currency) {
    return ctx.currency.toUpperCase();
  }

  const fromCountry = getCurrencyForCountry(ctx.country);
  if (fromCountry) {
    return fromCountry;
  }

  if (ctx.timezone) {
    const fromTz = TIMEZONE_CURRENCY[ctx.timezone];
    if (fromTz) {
      return fromTz;
    }
  }

  if (ctx.nationality) {
    const key = ctx.nationality.trim().toLowerCase();
    const fromNationality = NATIONALITY_CURRENCY[key];
    if (fromNationality) {
      return fromNationality;
    }
  }

  return 'ZAR';
}

export function formatCurrency(
  amount: number,
  currencyCode: string,
  countryCode?: string
): string {
  const currency = currencyCode.toUpperCase();
  const locale = (countryCode && LOCALE_BY_COUNTRY[countryCode.toUpperCase()]) || 'en';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
