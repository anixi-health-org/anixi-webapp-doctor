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
