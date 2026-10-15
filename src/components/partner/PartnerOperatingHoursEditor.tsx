import React, { useMemo } from 'react';
import clsx from 'clsx';

const partnerLabelClass = 'block text-sm font-medium text-[#344256]';
const partnerHelpClass = 'mt-1 text-xs text-[#65758b]';

export const WEEK_DAYS = [
  { key: 'mon', label: 'Mon', short: 'Mon' },
  { key: 'tue', label: 'Tue', short: 'Tue' },
  { key: 'wed', label: 'Wed', short: 'Wed' },
  { key: 'thu', label: 'Thu', short: 'Thu' },
  { key: 'fri', label: 'Fri', short: 'Fri' },
  { key: 'sat', label: 'Sat', short: 'Sat' },
  { key: 'sun', label: 'Sun', short: 'Sun' },
] as const;

export type DayKey = (typeof WEEK_DAYS)[number]['key'];

export type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type WeekSchedule = Record<DayKey, DayHours>;

const TIME_OPTIONS: string[] = (() => {
  const rows: string[] = [];
  for (let h = 6; h <= 22; h += 1) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      rows.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return rows;
})();

const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '18:00';
const DEFAULT_SAT_OPEN = '09:00';
const DEFAULT_SAT_CLOSE = '13:00';

function defaultSchedule(): WeekSchedule {
  const weekday: DayHours = { closed: false, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
  return {
    mon: { ...weekday },
    tue: { ...weekday },
    wed: { ...weekday },
    thu: { ...weekday },
    fri: { ...weekday },
    sat: { closed: false, open: DEFAULT_SAT_OPEN, close: DEFAULT_SAT_CLOSE },
    sun: { closed: true, open: DEFAULT_OPEN, close: DEFAULT_CLOSE },
  };
}

function normalizeTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function expandDayToken(token: string): DayKey[] {
  const t = token.toLowerCase().replace(/\./g, '');
  const map: Record<string, DayKey> = {
    mon: 'mon',
    monday: 'mon',
    tue: 'tue',
    tues: 'tue',
    tuesday: 'tue',
    wed: 'wed',
    wednesday: 'wed',
    thu: 'thu',
    thur: 'thu',
    thurs: 'thu',
    thursday: 'thu',
    fri: 'fri',
    friday: 'fri',
    sat: 'sat',
    saturday: 'sat',
    sun: 'sun',
    sunday: 'sun',
  };
  if (map[t]) return [map[t]];
  const range = t.match(/^(mon|tue|wed|thu|fri|sat|sun)\s*[–\-—to]+\s*(mon|tue|wed|thu|fri|sat|sun)$/i);
  if (range) {
    const keys = WEEK_DAYS.map((d) => d.key);
    const start = map[range[1].toLowerCase()];
    const end = map[range[2].toLowerCase()];
    if (!start || !end) return [];
    const a = keys.indexOf(start);
    const b = keys.indexOf(end);
    if (a < 0 || b < 0 || a > b) return [];
    return keys.slice(a, b + 1);
  }
  return [];
}

/** Best-effort parse of saved free-text hours into a week schedule. */
export function parseOperatingHours(value: string): WeekSchedule {
  const schedule = defaultSchedule();
  const trimmed = value.trim();
  if (!trimmed) return schedule;

  // Start closed so only parsed days open; if nothing parses, fall back to defaults.
  let matched = false;
  for (const key of WEEK_DAYS.map((d) => d.key)) {
    schedule[key] = { closed: true, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
  }

  const lines = trimmed.split(/[\n·•|;]+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const closedMatch = line.match(
      /^(.+?)\s*[–\-—:]?\s*(closed|off|shut)$/i,
    );
    const openMatch = line.match(
      /^(.+?)\s+(\d{1,2}:\d{2})\s*[–\-—to]+\s*(\d{1,2}:\d{2})$/i,
    );

    if (closedMatch) {
      const days = expandDayToken(closedMatch[1].replace(/,/g, ' ').trim());
      for (const day of days) {
        schedule[day] = { closed: true, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
        matched = true;
      }
      continue;
    }
    if (openMatch) {
      const days = expandDayToken(openMatch[1].replace(/,/g, ' ').trim());
      const open = normalizeTime(openMatch[2]);
      const close = normalizeTime(openMatch[3]);
      if (!open || !close || days.length === 0) continue;
      for (const day of days) {
        schedule[day] = { closed: false, open, close };
        matched = true;
      }
    }
  }

  return matched ? schedule : defaultSchedule();
}

function dayLabel(keys: DayKey[]): string {
  if (keys.length === 1) {
    return WEEK_DAYS.find((d) => d.key === keys[0])!.short;
  }
  const first = WEEK_DAYS.find((d) => d.key === keys[0])!.short;
  const last = WEEK_DAYS.find((d) => d.key === keys[keys.length - 1])!.short;
  return `${first}–${last}`;
}

/** Compact readable string for Market display + checklist. */
export function formatOperatingHours(schedule: WeekSchedule): string {
  const keys = WEEK_DAYS.map((d) => d.key);
  const lines: string[] = [];
  let i = 0;
  while (i < keys.length) {
    const day = keys[i];
    const hours = schedule[day];
    let j = i + 1;
    while (j < keys.length) {
      const next = schedule[keys[j]];
      if (
        next.closed === hours.closed &&
        next.open === hours.open &&
        next.close === hours.close
      ) {
        j += 1;
      } else {
        break;
      }
    }
    const span = keys.slice(i, j);
    const label = dayLabel(span);
    lines.push(
      hours.closed ? `${label} closed` : `${label} ${hours.open}–${hours.close}`,
    );
    i = j;
  }
  return lines.join('\n');
}

const PRESETS: { id: string; label: string; build: () => WeekSchedule }[] = [
  {
    id: 'standard',
    label: 'Standard',
    build: () => defaultSchedule(),
  },
  {
    id: 'weekdays',
    label: 'Weekdays only',
    build: () => {
      const s = defaultSchedule();
      s.sat = { closed: true, open: DEFAULT_SAT_OPEN, close: DEFAULT_SAT_CLOSE };
      s.sun = { closed: true, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
      for (const key of ['mon', 'tue', 'wed', 'thu', 'fri'] as DayKey[]) {
        s[key] = { closed: false, open: '08:00', close: '17:00' };
      }
      return s;
    },
  },
  {
    id: 'extended',
    label: 'Extended',
    build: () => {
      const s = defaultSchedule();
      for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as DayKey[]) {
        s[key] = { closed: false, open: '08:00', close: '20:00' };
      }
      s.sun = { closed: false, open: '09:00', close: '13:00' };
      return s;
    },
  },
];

const selectClass =
  'rounded-lg border border-[#d9e0da] bg-white px-2.5 py-1.5 text-sm text-[#1f2a26] focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20 disabled:bg-[#f4f6f5] disabled:text-[#94a3b8]';

type Props = {
  value: string;
  onChange: (next: string) => void;
  id?: string;
};

export const PartnerOperatingHoursEditor: React.FC<Props> = ({
  value,
  onChange,
  id = 'operatingHours',
}) => {
  const schedule = useMemo(() => parseOperatingHours(value), [value]);

  const commit = (next: WeekSchedule) => {
    onChange(formatOperatingHours(next));
  };

  const patchDay = (key: DayKey, patch: Partial<DayHours>) => {
    const current = schedule[key];
    const nextDay: DayHours = {
      ...current,
      ...patch,
    };
    if (!nextDay.closed) {
      // Keep open before close when possible.
      if (nextDay.open >= nextDay.close) {
        const openIdx = TIME_OPTIONS.indexOf(nextDay.open);
        const fallback = TIME_OPTIONS[Math.min(openIdx + 2, TIME_OPTIONS.length - 1)] || '18:00';
        nextDay.close = fallback;
      }
    }
    commit({ ...schedule, [key]: nextDay });
  };

  const summary = value.trim() || formatOperatingHours(schedule);

  return (
    <div id="operating-hours" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={partnerLabelClass} htmlFor={id}>
          Working hours
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => commit(preset.build())}
              className="rounded-full border border-[#d9e0da] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256] hover:border-anixi-green/40 hover:bg-[#f7faf8]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e1e7ef]">
        <ul className="divide-y divide-[#eef2ef]">
          {WEEK_DAYS.map((day) => {
            const hours = schedule[day.key];
            return (
              <li
                key={day.key}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="w-12 shrink-0 text-sm font-semibold text-[#1a4d4d]">
                  {day.label}
                </span>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#65758b]">
                    <input
                      type="checkbox"
                      checked={hours.closed}
                      onChange={(e) =>
                        patchDay(day.key, {
                          closed: e.target.checked,
                          open: hours.open || DEFAULT_OPEN,
                          close: hours.close || DEFAULT_CLOSE,
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-[#d9e0da] text-anixi-green focus:ring-anixi-green"
                    />
                    Closed
                  </label>
                  <select
                    aria-label={`${day.label} opens`}
                    className={clsx(selectClass, 'w-[5.5rem]')}
                    value={hours.open}
                    disabled={hours.closed}
                    onChange={(e) => patchDay(day.key, { open: e.target.value })}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[#94a3b8]">to</span>
                  <select
                    aria-label={`${day.label} closes`}
                    className={clsx(selectClass, 'w-[5.5rem]')}
                    value={hours.close}
                    disabled={hours.closed}
                    onChange={(e) => patchDay(day.key, { close: e.target.value })}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Hidden field keeps native form semantics / focus target for checklist Fix */}
      <input id={id} type="hidden" value={value} readOnly />

      <p className={partnerHelpClass}>Preview: {summary.replace(/\n/g, ' · ')}</p>
      {!value.trim() ? (
        <p className="text-xs font-medium text-amber-800">
          Pick a preset or set each day, then save your listing.
        </p>
      ) : null}
    </div>
  );
};
