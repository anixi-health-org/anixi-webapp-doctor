import {
  classifyDoseEvent,
  defaultAdherenceRules,
  labelFromAdherenceRate,
  normalizeAdherenceRules,
  outcomeToLegacyBucket,
} from './adherenceEventModel';

describe('adherenceEventModel', () => {
  const rules = defaultAdherenceRules();

  it('marks future doses as expected', () => {
    const scheduled = new Date(Date.now() + 60 * 60_000);
    expect(
      classifyDoseEvent({ apiStatus: 'pending', scheduledTime: scheduled }, rules)
    ).toBe('expected');
  });

  it('marks on-time takes as taken', () => {
    const scheduled = new Date('2026-01-01T08:00:00Z');
    const takenTime = new Date('2026-01-01T08:30:00Z');
    expect(
      classifyDoseEvent(
        { apiStatus: 'taken', scheduledTime: scheduled, takenTime },
        rules
      )
    ).toBe('taken');
  });

  it('marks late takes after late window', () => {
    const scheduled = new Date('2026-01-01T08:00:00Z');
    const takenTime = new Date('2026-01-01T10:00:00Z');
    expect(
      classifyDoseEvent(
        { apiStatus: 'taken', scheduledTime: scheduled, takenTime },
        { ...rules, lateWindowMinutes: 60 }
      )
    ).toBe('late');
  });

  it('promotes stale pending to missed after miss cutoff', () => {
    const scheduled = new Date(Date.now() - 8 * 60 * 60_000);
    expect(
      classifyDoseEvent(
        { apiStatus: 'pending', scheduledTime: scheduled },
        { ...rules, missCutoffMinutes: 360 }
      )
    ).toBe('missed');
  });

  it('maps late to taken when countLateAsTaken', () => {
    expect(outcomeToLegacyBucket('late', { ...rules, countLateAsTaken: true })).toBe(
      'taken'
    );
    expect(outcomeToLegacyBucket('late', { ...rules, countLateAsTaken: false })).toBe(
      'missed'
    );
  });

  it('labels adherence bands from config', () => {
    const cfg = normalizeAdherenceRules({
      excellentMinPct: 90,
      moderateMinPct: 70,
    });
    expect(labelFromAdherenceRate(92, true, cfg)).toBe('excellent');
    expect(labelFromAdherenceRate(75, true, cfg)).toBe('moderate');
    expect(labelFromAdherenceRate(40, true, cfg)).toBe('low');
    expect(labelFromAdherenceRate(0, false, cfg)).toBe('no-data');
  });
});
