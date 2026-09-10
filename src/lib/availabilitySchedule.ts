import type { BookableBlock, DayOfWeek } from '../types';

export type AvailabilityPeriod = {
  startTime: string;
  endTime: string;
};

export const WEEKDAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
};

export const formatClock = (hhmm: string): string => {
  const [hRaw, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(m)) return hhmm;
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
};

export const periodsOverlap = (
  a: AvailabilityPeriod,
  b: AvailabilityPeriod,
): boolean => {
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  return aStart < bEnd && aEnd > bStart;
};

export const validateAvailabilityPeriods = (
  periods: AvailabilityPeriod[],
): { ok: true } | { ok: false; error: string } => {
  if (periods.length === 0) {
    return { ok: true };
  }

  for (const period of periods) {
    const start = toMinutes(period.startTime);
    const end = toMinutes(period.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { ok: false, error: 'Enter valid start and end times.' };
    }
    if (end <= start) {
      return { ok: false, error: 'Each period must end after it starts.' };
    }
    if (end - start < 15) {
      return { ok: false, error: 'Each period must be at least 15 minutes.' };
    }
  }

  const sorted = [...periods].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (periodsOverlap(sorted[i], sorted[j])) {
        return { ok: false, error: 'Availability periods cannot overlap.' };
      }
      if (
        sorted[i].startTime === sorted[j].startTime &&
        sorted[i].endTime === sorted[j].endTime
      ) {
        return { ok: false, error: 'Remove duplicate availability periods.' };
      }
    }
  }

  return { ok: true };
};

export const groupBlocksByDay = (
  blocks: BookableBlock[],
): Record<DayOfWeek, BookableBlock[]> => {
  const map: Record<DayOfWeek, BookableBlock[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };
  blocks
    .filter((b) => b.active !== false)
    .forEach((b) => {
      map[b.dayOfWeek].push(b);
    });
  WEEKDAY_ORDER.forEach((day) => {
    map[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
  });
  return map;
};

export const periodsFromBlocks = (blocks: BookableBlock[]): AvailabilityPeriod[] =>
  blocks
    .filter((b) => b.active !== false)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((b) => ({ startTime: b.startTime, endTime: b.endTime }));

export const summarizeWeek = (
  byDay: Record<DayOfWeek, BookableBlock[]>,
): string => {
  const available = WEEKDAY_ORDER.filter((d) => byDay[d].length > 0);
  if (available.length === 0) return 'No weekly availability set yet.';

  const weekdaySet = [1, 2, 3, 4, 5];
  const isWeekdays =
    available.length === 5 && weekdaySet.every((d) => available.includes(d as DayOfWeek));

  const rangeLabel = (day: DayOfWeek) =>
    byDay[day].map((b) => `${formatClock(b.startTime)}-${formatClock(b.endTime)}`).join(', ');

  if (isWeekdays) {
    const first = rangeLabel(1);
    const same = weekdaySet.every((d) => rangeLabel(d as DayOfWeek) === first);
    if (same) return `Monday-Friday · ${first}`;
  }

  return available
    .map((d) => `${DAY_SHORT[d]} ${rangeLabel(d)}`)
    .join(' · ');
};

export const inferDefaultAppointmentSettings = (
  blocks: BookableBlock[],
): { slotDurationMinutes: number; bufferAfterMinutes: number } => {
  const active = blocks.filter((b) => b.active !== false);
  if (active.length === 0) {
    return { slotDurationMinutes: 30, bufferAfterMinutes: 5 };
  }
  const durationCounts = new Map<number, number>();
  const bufferCounts = new Map<number, number>();
  active.forEach((b) => {
    durationCounts.set(
      b.slotDurationMinutes,
      (durationCounts.get(b.slotDurationMinutes) ?? 0) + 1,
    );
    bufferCounts.set(
      b.bufferAfterMinutes,
      (bufferCounts.get(b.bufferAfterMinutes) ?? 0) + 1,
    );
  });
  const pick = (map: Map<number, number>, fallback: number) => {
    let best = fallback;
    let bestCount = -1;
    map.forEach((count, value) => {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    });
    return best;
  };
  return {
    slotDurationMinutes: pick(durationCounts, 30),
    bufferAfterMinutes: pick(bufferCounts, 5),
  };
};
