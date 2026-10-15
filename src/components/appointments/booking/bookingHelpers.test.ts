import {
  addDaysToKey,
  diagnoseEmptySlots,
  filterUpcomingSlots,
  firstDoctorWithHours,
  mondayOfWeek,
  nextDateKeyWithHours,
  weekKeys,
} from './bookingHelpers';
import type { AvailableSlot, BookableBlock } from '../../../types';

const block = (overrides: Partial<BookableBlock>): BookableBlock => ({
  id: 'b1',
  practiceId: 'p1',
  doctorId: 'doc-1',
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
  locationId: '',
  allowedConsultTypes: ['initial'],
  slotDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  active: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('bookingHelpers', () => {
  it('builds a Monday-starting week', () => {
    expect(mondayOfWeek('2026-09-16')).toBe('2026-09-14');
    expect(weekKeys('2026-09-16')[0]).toBe('2026-09-14');
    expect(weekKeys('2026-09-16')[6]).toBe('2026-09-20');
  });

  it('prefers a doctor who has published hours', () => {
    expect(
      firstDoctorWithHours(
        ['owner', 'clinician'],
        [block({ doctorId: 'clinician', dayOfWeek: 1 })],
      ),
    ).toBe('clinician');
  });

  it('finds the next day with hours', () => {
    expect(
      nextDateKeyWithHours('2026-09-14', [block({ dayOfWeek: 3 })], 'doc-1'),
    ).toBe('2026-09-16');
  });

  it('drops slots that have already ended', () => {
    const now = new Date('2026-09-14T12:00:00');
    const slots: AvailableSlot[] = [
      {
        startAt: new Date('2026-09-14T09:00:00'),
        endAt: new Date('2026-09-14T09:30:00'),
        locationId: '',
        consultTypes: ['initial'],
        bookableBlockId: 'b1',
      },
      {
        startAt: new Date('2026-09-14T14:00:00'),
        endAt: new Date('2026-09-14T14:30:00'),
        locationId: '',
        consultTypes: ['initial'],
        bookableBlockId: 'b1',
      },
    ];
    expect(filterUpcomingSlots(slots, now)).toHaveLength(1);
  });

  it('diagnoses missing hours vs a fully booked day', () => {
    expect(
      diagnoseEmptySlots({
        doctorId: 'doc-1',
        selectedDate: '2026-09-14',
        hoursToday: [],
        upcomingCount: 0,
        rawCount: 0,
      }),
    ).toBe('no-hours');
    expect(
      diagnoseEmptySlots({
        doctorId: 'doc-1',
        selectedDate: addDaysToKey('2026-09-14', 1),
        hoursToday: [block({ dayOfWeek: 2 })],
        upcomingCount: 0,
        rawCount: 0,
      }),
    ).toBe('full');
  });
});
