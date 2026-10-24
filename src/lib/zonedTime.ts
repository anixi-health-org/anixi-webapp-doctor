/**
 * Wall-clock times in a practice's IANA timezone, independent of the browser's zone.
 * A clinic's 09:00 must be 09:00 at the clinic even when the person booking is abroad.
 */

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatter.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatter.set(timeZone, fmt);
  }
  return fmt;
}

/** Milliseconds `timeZone` is ahead of UTC at the given instant. */
function offsetMs(timeZone: string, utcMs: number): number {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The instant when the clock in `timeZone` reads year-month-day hour:minute (month is 0-based). */
export function zonedInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month, day, hour, minute);
  const first = offsetMs(timeZone, guess);
  let instant = guess - first;
  const second = offsetMs(timeZone, instant);
  if (second !== first) instant = guess - second;
  return new Date(instant);
}

/** Same calendar day as `calendarDay` (read from its local fields) at hh:mm in `timeZone`. */
export function zonedDayTime(calendarDay: Date, hhmm: string, timeZone: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return zonedInstant(
    calendarDay.getFullYear(),
    calendarDay.getMonth(),
    calendarDay.getDate(),
    h,
    m,
    timeZone,
  );
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Clock fields of `date` as read in `timeZone` (month is 0-based, weekday 0 = Sunday). */
export function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}
