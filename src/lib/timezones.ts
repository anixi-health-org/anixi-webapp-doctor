/** Common IANA timezones for practice scheduling. */
export const PRACTICE_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
  { value: 'Africa/Gaborone', label: 'Africa/Gaborone (CAT)' },
  { value: 'Africa/Windhoek', label: 'Africa/Windhoek (CAT)' },
  { value: 'Africa/Harare', label: 'Africa/Harare (CAT)' },
  { value: 'Africa/Maputo', label: 'Africa/Maputo (CAT)' },
  { value: 'Africa/Lusaka', label: 'Africa/Lusaka (CAT)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (GMT)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (WET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Toronto', label: 'America/Toronto (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)' },
  { value: 'UTC', label: 'UTC' },
];

/** Main timezone for each practice country offered at registration (ISO 3166-1 alpha-2). */
const COUNTRY_DEFAULT_TIMEZONE: Record<string, string> = {
  ZA: 'Africa/Johannesburg',
  BW: 'Africa/Gaborone',
  NA: 'Africa/Windhoek',
  ZW: 'Africa/Harare',
  MZ: 'Africa/Maputo',
  ZM: 'Africa/Lusaka',
  KE: 'Africa/Nairobi',
  NG: 'Africa/Lagos',
  GH: 'Africa/Accra',
  EG: 'Africa/Cairo',
  MA: 'Africa/Casablanca',
  GB: 'Europe/London',
  IE: 'Europe/London',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  CH: 'Europe/Zurich',
  US: 'America/New_York',
  CA: 'America/Toronto',
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  IN: 'Asia/Kolkata',
  JP: 'Asia/Tokyo',
  CN: 'Asia/Shanghai',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
};

/**
 * Default practice timezone: the country the clinic registered in, not the browser of
 * whoever is doing setup (Anixi ops often onboard South African clinics from abroad).
 */
export function defaultPracticeTimezone(country?: string | null): string {
  const fromCountry = country ? COUNTRY_DEFAULT_TIMEZONE[country.toUpperCase()] : undefined;
  if (fromCountry) return fromCountry;
  const detected = detectBrowserTimezone();
  return detected === 'UTC' ? 'Africa/Johannesburg' : detected;
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg';
  } catch {
    return 'Africa/Johannesburg';
  }
}

/** Options for a select, including a value that may not be in the curated list. */
export function timezoneSelectOptions(current?: string): { value: string; label: string }[] {
  const options = [...PRACTICE_TIMEZONES];
  if (current && !options.some((o) => o.value === current)) {
    options.unshift({ value: current, label: current });
  }
  return options;
}

/** YYYY-MM-DD in the given IANA timezone. */
export function calendarDateKeyInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function addCalendarDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return next.toISOString().slice(0, 10);
}

function weekdayIndexInTimeZone(instant: Date, timeZone: string): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

export type DashboardDateRangeKey = 'today' | 'yesterday' | 'week' | '7days' | 'month';

/** Inclusive calendar-day bounds in a practice timezone (YYYY-MM-DD strings). */
export function getCalendarRangeInTimeZone(
  key: DashboardDateRangeKey,
  timeZone: string,
  now: Date = new Date(),
): { startKey: string; endKey: string } {
  const todayKey = calendarDateKeyInTimeZone(now, timeZone);

  if (key === 'today') {
    return { startKey: todayKey, endKey: todayKey };
  }

  if (key === 'yesterday') {
    const yesterdayKey = addCalendarDays(todayKey, -1);
    return { startKey: yesterdayKey, endKey: yesterdayKey };
  }

  if (key === 'week') {
    const day = weekdayIndexInTimeZone(now, timeZone);
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStartKey = addCalendarDays(todayKey, mondayOffset);
    return { startKey: weekStartKey, endKey: todayKey };
  }

  if (key === '7days') {
    return { startKey: addCalendarDays(todayKey, -6), endKey: todayKey };
  }

  const monthPrefix = todayKey.slice(0, 7);
  return { startKey: `${monthPrefix}-01`, endKey: todayKey };
}

export function instantInCalendarRange(
  instant: Date,
  startKey: string,
  endKey: string,
  timeZone: string,
): boolean {
  const key = calendarDateKeyInTimeZone(instant, timeZone);
  return key >= startKey && key <= endKey;
}
