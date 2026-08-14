/**
 * Cross-system appointment invariants.
 *
 * An appointment lives in three places — the shared `appointments` record and a
 * copy under each participant — and the patient app and doctor portal each read
 * different ones. These tests pin the behaviour that keeps the two sides showing
 * the same state.
 */
import type { Appointment } from '../types';

type DocData = Record<string, any>;

interface WriteRecord {
  path: string;
  data: DocData;
  merge: boolean;
  op: 'set' | 'update';
}

const mockDocStore = new Map<string, DocData>();
const mockCollectionStore = new Map<string, Map<string, DocData>>();
const mockWrites: WriteRecord[] = [];
const mockSnapshotListeners = new Map<string, (snapshot: any) => void>();

const mockSeedDoc = (path: string, data: DocData) => {
  mockDocStore.set(path, data);
  const lastSlash = path.lastIndexOf('/');
  const parent = path.slice(0, lastSlash);
  const id = path.slice(lastSlash + 1);
  if (!mockCollectionStore.has(parent)) mockCollectionStore.set(parent, new Map());
  mockCollectionStore.get(parent)!.set(id, data);
};

const mockMakeSnapshot = (path: string) => {
  const entries = Array.from(mockCollectionStore.get(path)?.entries() ?? []);
  return {
    docs: entries.map(([id, data]) => ({ id, data: () => data, exists: () => true })),
    forEach: (cb: (doc: any) => void) =>
      entries.forEach(([id, data]) => cb({ id, data: () => data, exists: () => true })),
  };
};

jest.mock('../lib/firebase', () => ({ db: {}, storage: {} }));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('firebase/firestore', () => {
  const joinPath = (_db: unknown, ...segments: string[]) => segments.join('/');

  return {
    collection: (_db: unknown, ...segments: string[]) => ({
      __type: 'collection',
      path: joinPath(_db, ...segments),
    }),
    doc: (_db: unknown, ...segments: string[]) => ({
      __type: 'doc',
      path: joinPath(_db, ...segments),
    }),
    query: (ref: any, ...constraints: any[]) => ({ __type: 'query', ref, constraints }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    orderBy: (field: string, direction?: string) => ({ field, direction }),
    limit: (count: number) => ({ count }),
    arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
    serverTimestamp: () => ({ __serverTimestamp: true }),
    Timestamp: {
      fromDate: (date: Date) => ({ toDate: () => date }),
      now: () => ({ toDate: () => new Date() }),
    },
    getDoc: async (ref: any) => {
      const data = mockDocStore.get(ref.path);
      return { exists: () => data !== undefined, id: ref.path.split('/').pop(), data: () => data };
    },
    getDocs: async (refOrQuery: any) => {
      const target = refOrQuery.__type === 'query' ? refOrQuery.ref : refOrQuery;
      return mockMakeSnapshot(target.path);
    },
    setDoc: async (ref: any, data: DocData, options?: { merge?: boolean }) => {
      mockWrites.push({ path: ref.path, data, merge: Boolean(options?.merge), op: 'set' });
    },
    updateDoc: async (ref: any, data: DocData) => {
      mockWrites.push({ path: ref.path, data, merge: true, op: 'update' });
    },
    addDoc: async (ref: any, data: DocData) => {
      mockWrites.push({ path: `${ref.path}/generated-id`, data, merge: false, op: 'set' });
      return { id: 'generated-id' };
    },
    onSnapshot: (refOrQuery: any, onNext: (snapshot: any) => void) => {
      const target = refOrQuery.__type === 'query' ? refOrQuery.ref : refOrQuery;
      mockSnapshotListeners.set(target.path, onNext);
      onNext(mockMakeSnapshot(target.path));
      return () => mockSnapshotListeners.delete(target.path);
    },
  };
});

const DOCTOR_ID = 'doctor-1';
const PATIENT_ID = 'patient-1';
const APPOINTMENT_ID = 'appointment-1';

const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

const appointmentDoc = (overrides: DocData = {}): DocData => ({
  doctorId: DOCTOR_ID,
  patientId: PATIENT_ID,
  patientName: 'Adama Jarju',
  patientEmail: 'patient@example.com',
  type: 'Virtual',
  consultType: 'teleconsult',
  status: 'pending',
  date: futureDate,
  time: '10:00 AM',
  ...overrides,
});

const writesFor = (path: string) => mockWrites.filter((write) => write.path === path);

describe('appointment source of truth', () => {
  beforeEach(() => {
    mockDocStore.clear();
    mockCollectionStore.clear();
    mockWrites.length = 0;
    mockSnapshotListeners.clear();
    jest.resetModules();
  });

  it('propagates a doctor status change to the shared record and both participants', async () => {
    const { updateAppointment } = await import('./appointmentService');

    mockSeedDoc(`Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`, appointmentDoc());

    await updateAppointment(DOCTOR_ID, APPOINTMENT_ID, { status: 'confirmed' });

    const expectedPaths = [
      `appointments/${APPOINTMENT_ID}`,
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      `Users/${PATIENT_ID}/appointments/${APPOINTMENT_ID}`,
    ];

    expectedPaths.forEach((path) => {
      const written = writesFor(path);
      expect(written.length).toBeGreaterThan(0);
      expect(written[0].data.status).toBe('confirmed');
    });
  });

  it('keeps a no-show marked as a no-show instead of reverting it to pending', async () => {
    const { getDoctorAppointments } = await import('./appointmentService');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'no_show', date: pastDate })
    );

    const appointments = await getDoctorAppointments(DOCTOR_ID);

    expect(appointments).toHaveLength(1);
    expect(appointments[0].status).toBe('no_show');
  });

  it('keeps a patient reschedule as rescheduled instead of folding it into pending', async () => {
    const { getDoctorAppointments } = await import('./appointmentService');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'rescheduled' })
    );

    const appointments = await getDoctorAppointments(DOCTOR_ID);

    expect(appointments[0].status).toBe('rescheduled');
  });

  it('does not coerce an unknown status into pending', async () => {
    const { getDoctorAppointments } = await import('./appointmentService');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'mystery_state' })
    );

    const appointments = await getDoctorAppointments(DOCTOR_ID);

    expect(appointments).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cancels the patient copy when a past pending appointment is auto-cancelled', async () => {
    const { getDoctorAppointments } = await import('./appointmentService');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'pending', date: pastDate, time: '09:00 AM' })
    );

    await getDoctorAppointments(DOCTOR_ID);

    const patientWrites = writesFor(`Users/${PATIENT_ID}/appointments/${APPOINTMENT_ID}`);
    expect(patientWrites.length).toBeGreaterThan(0);
    expect(patientWrites[0].data.status).toBe('auto_cancelled');
  });

  it('shows an appointment the patient booked, which exists only as mirrored copies', async () => {
    const { getDoctorAppointments } = await import('./appointmentService');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ source: 'anixi' })
    );

    const appointments = await getDoctorAppointments(DOCTOR_ID);

    expect(appointments.map((apt: Appointment) => apt.id)).toContain(APPOINTMENT_ID);
    expect(appointments[0].patientId).toBe(PATIENT_ID);
  });
});

describe('live appointment listener', () => {
  beforeEach(() => {
    mockDocStore.clear();
    mockCollectionStore.clear();
    mockWrites.length = 0;
    mockSnapshotListeners.clear();
    jest.resetModules();
  });

  it('emits again when the patient cancels, without a refetch', async () => {
    const { listenToDoctorAppointments } = await import('./appointmentService');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'confirmed' })
    );

    const emissions: Appointment[][] = [];
    const unsubscribe = listenToDoctorAppointments(DOCTOR_ID, (appointments) =>
      emissions.push(appointments)
    );

    expect(emissions[emissions.length - 1][0].status).toBe('confirmed');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'cancelled' })
    );
    mockSnapshotListeners.get(`Users/${DOCTOR_ID}/appointments`)!(
      mockMakeSnapshot(`Users/${DOCTOR_ID}/appointments`)
    );

    expect(emissions[emissions.length - 1][0].status).toBe('cancelled');

    unsubscribe();
    expect(mockSnapshotListeners.size).toBe(0);
  });

  it('prefers the shared record when both copies exist', async () => {
    const { listenToDoctorAppointments } = await import('./appointmentService');

    mockSeedDoc(`appointments/${APPOINTMENT_ID}`, appointmentDoc({ status: 'cancelled' }));
    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({ status: 'confirmed' })
    );

    const emissions: Appointment[][] = [];
    listenToDoctorAppointments(DOCTOR_ID, (appointments) => emissions.push(appointments));

    const latest = emissions[emissions.length - 1];
    expect(latest).toHaveLength(1);
    expect(latest[0].status).toBe('cancelled');
  });
});

describe('canonical appointment time', () => {
  beforeEach(() => {
    mockDocStore.clear();
    mockCollectionStore.clear();
    mockWrites.length = 0;
    jest.resetModules();
  });

  it('derives the display clock from scheduledAt instead of inventing 10:00 AM', async () => {
    const { getDoctorAppointments } = await import('./appointmentService');
    const scheduledAt = new Date('2026-08-13T08:00:00.000Z');

    mockSeedDoc(
      `Users/${DOCTOR_ID}/appointments/${APPOINTMENT_ID}`,
      appointmentDoc({
        scheduledAt,
        time: '',
        date: scheduledAt,
      })
    );

    const appointments = await getDoctorAppointments(DOCTOR_ID);
    expect(appointments[0].scheduledAt?.toISOString()).toBe(scheduledAt.toISOString());
    expect(appointments[0].time).not.toBe('10:00 AM');
    expect(appointments[0].time).not.toBe('');
  });
});
