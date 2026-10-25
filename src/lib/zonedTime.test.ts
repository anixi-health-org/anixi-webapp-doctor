import { generateRawSlots } from '../services/schedulingService';
import type { BookableBlock } from '../types';
import { zonedDayTime, zonedInstant, zonedParts } from './zonedTime';

describe('zonedTime', () => {
  it('maps a Johannesburg wall-clock time to the right UTC instant', () => {
    expect(zonedInstant(2026, 9, 26, 9, 50, 'Africa/Johannesburg').toISOString()).toBe(
      '2026-10-26T07:50:00.000Z',
    );
  });

  it('handles zones with daylight saving', () => {
    // London is on BST (UTC+1) in July and GMT in December.
    expect(zonedInstant(2026, 6, 1, 9, 0, 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedInstant(2026, 11, 1, 9, 0, 'Europe/London').toISOString()).toBe('2026-12-01T09:00:00.000Z');
  });

  it('reads the calendar day from the local date fields', () => {
    const day = new Date(2026, 9, 26);
    expect(zonedDayTime(day, '08:00', 'Africa/Nairobi').toISOString()).toBe('2026-10-26T05:00:00.000Z');
  });

  it('generates clinic slots in the practice timezone, not the browser zone', () => {
    const block = {
      id: 'b1',
      doctorId: 'd1',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
      locationId: 'loc',
      allowedConsultTypes: ['follow-up'],
      slotDurationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      active: true,
    } as unknown as BookableBlock;
    const slots = generateRawSlots(new Date(2026, 9, 26), [block], null, {
      timeZone: 'Africa/Johannesburg',
    });
    expect(slots.map((s) => s.startAt.toISOString())).toEqual([
      '2026-10-26T06:00:00.000Z',
      '2026-10-26T06:30:00.000Z',
    ]);
    expect(slots[0].timeZone).toBe('Africa/Johannesburg');
  });

  it('reads clinic-local fields for validation', () => {
    // 07:50 UTC Monday is 09:50 Monday in Johannesburg.
    expect(zonedParts(new Date('2026-10-26T07:50:00Z'), 'Africa/Johannesburg')).toEqual({
      year: 2026,
      month: 9,
      day: 26,
      hour: 9,
      minute: 50,
      weekday: 1,
    });
  });
});
