import {
  defaultConsultTypeSettings,
  enabledConsultTypes,
  normalizeConsultTypeSettings,
  resolveConsultTypeSetting,
  validateConsultTypeSettingInput,
} from './consultTypeSettings';
import { generateRawSlots } from '../services/schedulingService';
import type { BookableBlock, ConsultTypeSetting } from '../types';

describe('consultTypeSettings', () => {
  it('creates defaults from legacy enabled list', () => {
    const settings = defaultConsultTypeSettings(['initial', 'follow-up']);
    expect(settings.find((s) => s.type === 'initial')?.enabled).toBe(true);
    expect(settings.find((s) => s.type === 'procedure')?.enabled).toBe(false);
    expect(settings.find((s) => s.type === 'initial')?.durationMinutes).toBe(45);
    expect(settings.find((s) => s.type === 'follow-up')?.durationMinutes).toBe(20);
  });

  it('normalizes stored settings without rewriting missing types', () => {
    const stored: ConsultTypeSetting[] = [
      {
        id: 'initial',
        type: 'initial',
        name: 'New patient',
        description: 'Custom',
        enabled: true,
        durationMinutes: 40,
        bufferMinutes: 10,
      },
    ];
    const normalized = normalizeConsultTypeSettings(stored, ['initial']);
    expect(normalized.find((s) => s.type === 'initial')?.durationMinutes).toBe(40);
    expect(normalized.find((s) => s.type === 'teleconsult')?.enabled).toBe(false);
  });

  it('rejects invalid duration', () => {
    const result = validateConsultTypeSettingInput({
      type: 'follow-up',
      durationMinutes: 0,
      bufferMinutes: 5,
    });
    expect(result.ok).toBe(false);
  });

  it('lists only enabled types', () => {
    const settings = defaultConsultTypeSettings(['teleconsult']);
    expect(enabledConsultTypes(settings)).toEqual(['teleconsult']);
  });
});

describe('generateRawSlots with appointment types', () => {
  const monday = new Date(2026, 7, 17); // Monday 17 Aug 2026
  const block: BookableBlock = {
    id: 'b1',
    practiceId: 'p1',
    doctorId: 'd1',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    locationId: 'loc1',
    allowedConsultTypes: ['initial', 'follow-up', 'teleconsult', 'procedure'],
    slotDurationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const settings = normalizeConsultTypeSettings([
    {
      id: 'initial',
      type: 'initial',
      name: 'New patient',
      description: '',
      enabled: true,
      durationMinutes: 45,
      bufferMinutes: 10,
    },
    {
      id: 'follow-up',
      type: 'follow-up',
      name: 'Follow-up',
      description: '',
      enabled: true,
      durationMinutes: 20,
      bufferMinutes: 5,
    },
    {
      id: 'teleconsult',
      type: 'teleconsult',
      name: 'Video',
      description: '',
      enabled: true,
      durationMinutes: 20,
      bufferMinutes: 5,
    },
    {
      id: 'procedure',
      type: 'procedure',
      name: 'Procedure',
      description: '',
      enabled: false,
      durationMinutes: 60,
      bufferMinutes: 15,
    },
  ]);

  it('generates different slot patterns for new patient vs follow-up', () => {
    const newPatient = generateRawSlots(monday, [block], null, {
      consultType: 'initial',
      typeSettings: settings,
    });
    const followUp = generateRawSlots(monday, [block], null, {
      consultType: 'follow-up',
      typeSettings: settings,
    });

    expect(newPatient.length).toBeGreaterThan(0);
    expect(followUp.length).toBeGreaterThan(newPatient.length);

    const npDurations = newPatient.map(
      (s) => (s.endAt.getTime() - s.startAt.getTime()) / 60000,
    );
    const fuDurations = followUp.map(
      (s) => (s.endAt.getTime() - s.startAt.getTime()) / 60000,
    );
    expect(npDurations.every((d) => d === 45)).toBe(true);
    expect(fuDurations.every((d) => d === 20)).toBe(true);
  });

  it('returns no slots for disabled appointment type', () => {
    const slots = generateRawSlots(monday, [block], null, {
      consultType: 'procedure',
      typeSettings: settings,
    });
    expect(slots).toEqual([]);
  });

  it('does not offer a slot that cannot fit full duration', () => {
    const shortBlock: BookableBlock = {
      ...block,
      startTime: '11:00',
      endTime: '12:00',
    };
    const slots = generateRawSlots(monday, [shortBlock], null, {
      consultType: 'initial',
      typeSettings: settings,
    });
    // 45 min into 60 min window → one slot at 11:00 only (not 11:30)
    expect(slots).toHaveLength(1);
    expect(slots[0].startAt.getHours()).toBe(11);
    expect(slots[0].startAt.getMinutes()).toBe(0);
  });

  it('falls back to block duration when no consult type is provided (legacy)', () => {
    const slots = generateRawSlots(monday, [block], null);
    const durations = slots.map(
      (s) => (s.endAt.getTime() - s.startAt.getTime()) / 60000,
    );
    expect(durations.every((d) => d === 30)).toBe(true);
  });

  it('resolves type setting correctly', () => {
    const setting = resolveConsultTypeSetting(settings, 'follow-up');
    expect(setting?.durationMinutes).toBe(20);
    expect(setting?.bufferMinutes).toBe(5);
  });
});
