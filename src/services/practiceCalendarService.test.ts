import { parseDailyScheduleRecord } from './practiceCalendarService';

describe('parseDailyScheduleRecord', () => {
  const practiceId = 'practice-1';
  const date = '2026-09-17';

  it('treats a missing or empty payload as weekly hours, not a closed day', () => {
    expect(parseDailyScheduleRecord(practiceId, date, null)).toBeNull();
    expect(parseDailyScheduleRecord(practiceId, date, undefined)).toBeNull();
    expect(parseDailyScheduleRecord(practiceId, date, {})).toBeNull();
    expect(parseDailyScheduleRecord(practiceId, date, { note: 'holiday' })).toBeNull();
  });

  it('keeps an explicit closed exception', () => {
    expect(
      parseDailyScheduleRecord(practiceId, date, { availability: 'closed', note: 'Public holiday' }),
    ).toMatchObject({
      practiceId,
      date,
      availability: 'closed',
      note: 'Public holiday',
    });
  });

  it('keeps reduced hours', () => {
    expect(
      parseDailyScheduleRecord(practiceId, date, {
        availability: 'limited',
        openTime: '08:00',
        closeTime: '13:00',
      }),
    ).toMatchObject({
      availability: 'limited',
      openTime: '08:00',
      closeTime: '13:00',
    });
  });
});
