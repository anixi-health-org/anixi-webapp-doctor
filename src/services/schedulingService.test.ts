import { getAvailableSlots, validateSlot } from './schedulingService';
import { getBookableBlocks, getAllSoftBlocks } from './practiceSettingsService';
import { getDoctorAppointments } from './appointmentService';
import { BookableBlock, SoftBlock, Appointment } from '../types';

jest.mock('./practiceSettingsService', () => ({
  getBookableBlocks: jest.fn(),
  getAllSoftBlocks: jest.fn(),
}));

jest.mock('./appointmentService', () => ({
  getDoctorAppointments: jest.fn(),
}));

const mockedGetBookableBlocks = getBookableBlocks as jest.MockedFunction<typeof getBookableBlocks>;
const mockedGetAllSoftBlocks = getAllSoftBlocks as jest.MockedFunction<typeof getAllSoftBlocks>;
const mockedGetDoctorAppointments = getDoctorAppointments as jest.MockedFunction<typeof getDoctorAppointments>;

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
      new Date('2026-05-11T10:30:00'),
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
      new Date('2026-05-11T10:15:00'),
      'initial'
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('appointment_conflict');
    expect(result.conflictingAppointmentId).toBe('apt-1');
  });
});
