import { parseDateKey, toDateKey } from '../../calendar/calendarDateUtils';
import { DAY_SHORT } from '../../../lib/availabilitySchedule';
import type { AvailableSlot, BookableBlock, DayOfWeek } from '../../../types';

export const slotKey = (slot: AvailableSlot): string =>
  `${slot.startAt.getTime()}-${slot.bookableBlockId}`;

export const localTodayKey = (): string => toDateKey(new Date());

export const addDaysToKey = (key: string, days: number): string => {
  const next = parseDateKey(key);
  next.setDate(next.getDate() + days);
  return toDateKey(next);
};

export const weekdayFromKey = (key: string): DayOfWeek =>
  parseDateKey(key).getDay() as DayOfWeek;

export const mondayOfWeek = (key: string): string => {
  const date = parseDateKey(key);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

export const weekKeys = (key: string): string[] => {
  const monday = parseDateKey(mondayOfWeek(key));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return toDateKey(date);
  });
};

export const formatBookingDate = (key: string): string =>
  parseDateKey(key).toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

export const formatBookingDateShort = (key: string): string =>
  parseDateKey(key).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export const formatSlotTime = (date: Date): string =>
  date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

export const slotDurationMinutes = (slot: AvailableSlot): number =>
  Math.max(1, Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60_000));

export const hoursForDoctorOnWeekday = (
  blocks: BookableBlock[],
  doctorId: string,
  weekday: DayOfWeek,
): BookableBlock[] =>
  blocks
    .filter(
      (block) =>
        block.doctorId === doctorId &&
        block.dayOfWeek === weekday &&
        block.active !== false,
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

export const formatHoursSummary = (blocks: BookableBlock[]): string =>
  blocks.map((block) => `${block.startTime} to ${block.endTime}`).join(', ');

export const doctorHasAnyHours = (blocks: BookableBlock[], doctorId: string): boolean =>
  blocks.some((block) => block.doctorId === doctorId && block.active !== false);

export const firstDoctorWithHours = (
  doctorIds: string[],
  blocks: BookableBlock[],
): string => doctorIds.find((id) => doctorHasAnyHours(blocks, id)) || doctorIds[0] || '';

export const nextDateKeyWithHours = (
  fromKey: string,
  blocks: BookableBlock[],
  doctorId: string,
  maxDays = 14,
): string | null => {
  for (let offset = 1; offset <= maxDays; offset += 1) {
    const key = addDaysToKey(fromKey, offset);
    if (hoursForDoctorOnWeekday(blocks, doctorId, weekdayFromKey(key)).length > 0) {
      return key;
    }
  }
  return null;
};

export const filterUpcomingSlots = (
  slots: AvailableSlot[],
  now = new Date(),
): AvailableSlot[] => slots.filter((slot) => slot.endAt.getTime() > now.getTime());

export type EmptySlotReason = 'no-doctor' | 'no-hours' | 'past' | 'full';

export const diagnoseEmptySlots = (opts: {
  doctorId: string;
  selectedDate: string;
  hoursToday: BookableBlock[];
  upcomingCount: number;
  rawCount: number;
  now?: Date;
}): EmptySlotReason => {
  if (!opts.doctorId) return 'no-doctor';
  if (opts.hoursToday.length === 0) return 'no-hours';
  if (opts.rawCount > 0 && opts.upcomingCount === 0) return 'past';
  const now = opts.now ?? new Date();
  if (opts.selectedDate === toDateKey(now) && opts.hoursToday.length > 0) {
    const lastEnd = opts.hoursToday.reduce((latest, block) => {
      const [hours, minutes] = block.endTime.split(':').map(Number);
      const end = parseDateKey(opts.selectedDate);
      end.setHours(hours, minutes, 0, 0);
      return end.getTime() > latest.getTime() ? end : latest;
    }, parseDateKey(opts.selectedDate));
    if (now.getTime() >= lastEnd.getTime()) return 'past';
  }
  return 'full';
};

export const weekdayLabel = (key: string): string => DAY_SHORT[weekdayFromKey(key)];

export const dayNumber = (key: string): string => String(parseDateKey(key).getDate());
