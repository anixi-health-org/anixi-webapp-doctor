export type PracticeCountry = {
  code: string;
  name: string;
  currency: string;
};

/** Countries supported at registration - ISO 3166-1 alpha-2 + default currency (ISO 4217). */
export const PRACTICE_COUNTRIES: PracticeCountry[] = [
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'MA', name: 'Morocco', currency: 'MAD' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'EG', name: 'Egypt', currency: 'EGP' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'CN', name: 'China', currency: 'CNY' },
];

const BY_CODE = new Map(PRACTICE_COUNTRIES.map((c) => [c.code, c]));

export function getCountryByCode(code: string | undefined): PracticeCountry | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.toUpperCase());
}

export function getCurrencyForCountry(countryCode: string | undefined): string | undefined {
  return getCountryByCode(countryCode)?.currency;
}

export function detectDefaultCountryCode(): string {
  try {
    const locale = navigator.language || 'en-ZA';
    const region = new Intl.Locale(locale).region;
    if (region && BY_CODE.has(region)) {
      return region;
    }
  } catch {
    // ignore
  }
  return 'ZA';
}
