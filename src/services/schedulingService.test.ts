import { getAvailableSlots, validateSlot, generateRawSlots } from './schedulingService';
import { getBookableBlocks, getAllSoftBlocks, getPractice } from './practiceSettingsService';
import { getDoctorAppointments } from './appointmentService';
import { getPracticeDailySchedule } from './practiceCalendarService';
import { BookableBlock, SoftBlock, Appointment, Practice } from '../types';
import { normalizeConsultTypeSettings } from '../lib/consultTypeSettings';

jest.mock('./practiceSettingsService', () => ({
  getBookableBlocks: jest.fn(),
  getAllSoftBlocks: jest.fn(),
  getPractice: jest.fn(),
}));

jest.mock('./appointmentService', () => ({
  getDoctorAppointments: jest.fn(),
}));

jest.mock('./practiceCalendarService', () => ({
  getPracticeDailySchedule: jest.fn(),
}));

const mockedGetBookableBlocks = getBookableBlocks as jest.MockedFunction<typeof getBookableBlocks>;
const mockedGetAllSoftBlocks = getAllSoftBlocks as jest.MockedFunction<typeof getAllSoftBlocks>;
const mockedGetDoctorAppointments = getDoctorAppointments as jest.MockedFunction<typeof getDoctorAppointments>;
const mockedGetPractice = getPractice as jest.MockedFunction<typeof getPractice>;
const mockedGetDaily = getPracticeDailySchedule as jest.MockedFunction<typeof getPracticeDailySchedule>;

const doctorId = 'doctor-1';
const practiceId = 'practice-1';

const makeBookableBlock = (): BookableBlock => ({
  id: 'block-1',
  practiceId,
  doctorId,
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '12:00',
  locationId: 'loc-1',
  allowedConsultTypes: ['initial', 'follow-up'],
  slotDurationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  active: true,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
});

const makePractice = (overrides?: Partial<Practice>): Practice => ({
  id: practiceId,
  name: 'Test Practice',
  timezone: 'Africa/Johannesburg',
  ownerId: doctorId,
  locations: [{ id: 'loc-1', name: 'Clinic', type: 'clinic' }],
  consultTypes: ['initial', 'follow-up'],
  consultTypeSettings: normalizeConsultTypeSettings([
    {
      id: 'initial',
      type: 'initial',
      name: 'New patient',
      description: '',
      enabled: true,
      durationMinutes: 60,
      bufferMinutes: 0,
    },
    {
      id: 'follow-up',
      type: 'follow-up',
      name: 'Follow-up',
      description: '',
      enabled: true,
      durationMinutes: 30,
      bufferMinutes: 0,
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
  ]),
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
  ...overrides,
});

const makeRecurringSoftBlock = (): SoftBlock => ({
  id: 'soft-1',
  practiceId,
  doctorId,
  title: 'Weekly Surgery',
  category: 'surgery',
  startAt: new Date('2026-05-04T10:00:00'),
  endAt: new Date('2026-05-04T11:00:00'),
  recurrence: {
    frequency: 'weekly',
    interval: 1,
  },
  createdBy: doctorId,
  updatedBy: doctorId,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
});

describe('schedulingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetBookableBlocks.mockResolvedValue([makeBookableBlock()]);
    mockedGetAllSoftBlocks.mockResolvedValue([]);
    mockedGetDoctorAppointments.mockResolvedValue([]);
    mockedGetPractice.mockResolvedValue(makePractice());
    mockedGetDaily.mockResolvedValue(null);
  });

  it('filters out recurring soft-block conflicts from available slots', async () => {
    mockedGetAllSoftBlocks.mockResolvedValue([makeRecurringSoftBlock()]);

    const slots = await getAvailableSlots(practiceId, doctorId, new Date('2026-05-11T00:00:00'), 'initial');
    const starts = slots.map((s) => s.startAt.getHours());

    expect(starts).toEqual([9, 11]);
  });

  it('returns soft block conflict for recurring occurrence in validateSlot', async () => {
    mockedGetAllSoftBlocks.mockResolvedValue([makeRecurringSoftBlock()]);

    const result = await validateSlot(
      practiceId,
      doctorId,
      new Date('2026-05-11T10:00:00'),
      new Date('2026-05-11T11:00:00'),
      'initial'
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('soft_block_conflict');
  });

  it('returns appointment conflict when overlapping an existing appointment', async () => {
    const appointment: Appointment = {
      id: 'apt-1',
      doctorId,
      patientId: 'p-1',
      patientName: 'Patient One',
      patientEmail: 'p1@example.com',
      type: 'In-Person',
      status: 'confirmed',
      date: new Date('2026-05-11T09:30:00'),
      time: '09:30 AM',
      startAt: new Date('2026-05-11T09:30:00'),
      endAt: new Date('2026-05-11T10:00:00'),
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    };

    mockedGetDoctorAppointments.mockResolvedValue([appointment]);

    const result = await validateSlot(
      practiceId,
      doctorId,
      new Date('2026-05-11T09:45:00'),
      new Date('2026-05-11T10:45:00'),
      'initial'
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('appointment_conflict');
    expect(result.conflictingAppointmentId).toBe('apt-1');
  });

  it('rejects disabled appointment types', async () => {
    const slots = await getAvailableSlots(
      practiceId,
      doctorId,
      new Date('2026-05-11T00:00:00'),
      'procedure',
    );
    expect(slots).toEqual([]);

    const result = await validateSlot(
      practiceId,
      doctorId,
      new Date('2026-05-11T09:00:00'),
      new Date('2026-05-11T10:00:00'),
      'procedure',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('consult_type_disabled');
  });

  it('rejects client duration that does not match appointment type', async () => {
    const result = await validateSlot(
      practiceId,
      doctorId,
      new Date('2026-05-11T09:00:00'),
      new Date('2026-05-11T09:20:00'), // claims 20 min but initial is 60
      'initial',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('duration_mismatch');
  });

  it('accepts authoritative duration for enabled type', async () => {
    const result = await validateSlot(
      practiceId,
      doctorId,
      new Date('2026-05-11T09:00:00'),
      new Date('2026-05-11T10:00:00'),
      'initial',
    );
    expect(result.valid).toBe(true);
    expect(result.resolvedDurationMinutes).toBe(60);
  });

  it('uses type duration when generating available slots', async () => {
    const slots = await getAvailableSlots(
      practiceId,
      doctorId,
      new Date('2026-05-11T00:00:00'),
      'follow-up',
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(
      slots.every((s) => (s.endAt.getTime() - s.startAt.getTime()) / 60000 === 30),
    ).toBe(true);
  });

  it('respects closed daily exceptions', async () => {
    mockedGetDaily.mockResolvedValue({
      practiceId,
      date: '2026-05-11',
      availability: 'closed',
      note: 'Public holiday',
      updatedAt: new Date(),
    });
    const slots = await getAvailableSlots(
      practiceId,
      doctorId,
      new Date('2026-05-11T00:00:00'),
      'initial',
    );
    expect(slots).toEqual([]);
  });

  it('legacy practice without consultTypeSettings still generates slots', async () => {
    mockedGetPractice.mockResolvedValue(
      makePractice({ consultTypeSettings: undefined, consultTypes: ['initial', 'follow-up'] }),
    );
    const slots = await getAvailableSlots(
      practiceId,
      doctorId,
      new Date('2026-05-11T00:00:00'),
      'initial',
    );
    expect(slots.length).toBeGreaterThan(0);
  });
});

describe('generateRawSlots closed exception', () => {
  it('returns empty when day is closed', () => {
    const slots = generateRawSlots(
      new Date('2026-05-11T00:00:00'),
      [makeBookableBlock()],
      {
        practiceId,
        date: '2026-05-11',
        availability: 'closed',
        updatedAt: new Date(),
      },
      { consultType: 'initial' },
    );
    expect(slots).toEqual([]);
  });
});
