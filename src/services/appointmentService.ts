import { Appointment, AppointmentDocument, PostConsultAction, PostConsultActionType } from '../types';
import { convertTimestamp } from '../utils/dateFormatter';
import {
  djangoBookAppointment,
  djangoListAppointments,
  djangoPatchAppointment,
  djangoUploadDocument,
} from './djangoApiService';
import {
  assertAppointmentStatus,
  effectiveAppointmentStatus,
  formatAppointmentClock,
  hasConsultBeenStarted,
  parseAppointmentStatus,
  resolveScheduledAt,
} from './appointmentCanonical';
import { calendarDateKeyInTimeZone } from '../lib/timezones';

export type Unsubscribe = () => void;

/** Local midnight Date whose Y/M/D match the practice calendar day. */
function clinicCalendarDate(instant: Date, timeZone: string): Date {
  const key = calendarDateKeyInTimeZone(instant, timeZone);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DEFAULT_APPOINTMENT_TZ = 'Africa/Johannesburg';

const resolveAppointmentTimezone = (data: Record<string, any>): string => {
  if (typeof data.timezone === 'string' && data.timezone.trim()) {
    return data.timezone.trim();
  }
  return DEFAULT_APPOINTMENT_TZ;
};

const normalizeAppointmentTime = (data: Record<string, any>): string => {
  const instant = resolveScheduledAt(data);
  if (instant) {
    return formatAppointmentClock(instant, resolveAppointmentTimezone(data));
  }
  if (typeof data.time === 'string' && data.time.trim().length > 0) {
    return data.time;
  }
  return 'Time unavailable';
};

const normalizeType = (type: any): Appointment['type'] => {
  if (!type) return 'In-Person';
  const normalized = String(type).toLowerCase().replace(/_/g, '-').trim();
  const typeMap: { [key: string]: Appointment['type'] } = {
    'in-person': 'In-Person',
    inperson: 'In-Person',
    virtual: 'Virtual',
    teleconsult: 'Virtual',
    telehealth: 'Virtual',
    video: 'Virtual',
    phone: 'Phone',
    'follow-up': 'Follow-up',
    followup: 'Follow-up',
  };
  return typeMap[normalized] || 'In-Person';
};

const normalizeAppointmentDocuments = (value: any): AppointmentDocument[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const downloadURL =
        typeof item.downloadURL === 'string'
          ? item.downloadURL
          : typeof item.url === 'string'
            ? item.url
            : '';
      const fileName = typeof item.fileName === 'string' ? item.fileName : 'document';
      if (!downloadURL) return null;
      return {
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: typeof item.title === 'string' ? item.title : undefined,
        fileName,
        fileType: typeof item.fileType === 'string' ? item.fileType : 'image/jpeg',
        fileSize: typeof item.fileSize === 'number' ? item.fileSize : 0,
        downloadURL,
        storagePath:
          typeof item.storagePath === 'string'
            ? item.storagePath
            : typeof item.storageKey === 'string'
              ? item.storageKey
              : '',
        createdAt: convertTimestamp(item.createdAt) || new Date(),
        createdBy: typeof item.createdBy === 'string' ? item.createdBy : '',
      } as AppointmentDocument;
    })
    .filter((item): item is AppointmentDocument => item !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

const normalizePostConsultActions = (value: any): PostConsultAction[] => {
  if (!Array.isArray(value)) return [];

  const validTypes: PostConsultActionType[] = [
    'prescription_draft',
    'doctor_letter_draft',
    'medical_document',
    'session_recording',
    'post_consult_note',
  ];

  return value
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const actionType = item.type as PostConsultActionType;
      if (!validTypes.includes(actionType)) return null;

      return {
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: actionType,
        title: typeof item.title === 'string' ? item.title : undefined,
        content: typeof item.content === 'string' ? item.content : '',
        status: item.status === 'finalized' ? 'finalized' : 'draft',
        metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined,
        createdBy: typeof item.createdBy === 'string' ? item.createdBy : '',
        createdAt: convertTimestamp(item.createdAt) || new Date(),
        updatedAt: convertTimestamp(item.updatedAt) || convertTimestamp(item.createdAt) || new Date(),
      } as PostConsultAction;
    })
    .filter((item): item is PostConsultAction => item !== null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

const normalizeTeleconsult = (value: any): Appointment['teleconsult'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  return {
    provider: value.provider === 'livekit' ? 'livekit' : undefined,
    roomName: typeof value.roomName === 'string' ? value.roomName : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    doctorJoinedAt: convertTimestamp(value.doctorJoinedAt) || undefined,
    patientJoinedAt: convertTimestamp(value.patientJoinedAt) || undefined,
    endedAt: convertTimestamp(value.endedAt) || undefined,
    updatedAt: convertTimestamp(value.updatedAt) || undefined,
  };
};

const mapAppointmentFields = (
  id: string,
  doctorId: string,
  data: Record<string, any>
): Appointment => {
  const parsedStatus = parseAppointmentStatus(data.status);
  if (!parsedStatus) {
    throw new Error(
      `Unknown appointment status "${String(data.status)}" for ${id}`
    );
  }

  const timeZone = resolveAppointmentTimezone(data);
  const instant = resolveScheduledAt(data);
  const date = instant
    ? clinicCalendarDate(instant, timeZone)
    : convertTimestamp(data.date);
  if (!date) {
    throw new Error(`Appointment ${id} has no scheduledAt or date`);
  }

  const editScope =
    data.editScope === 'slot' || data.editScope === 'visit_type'
      ? data.editScope
      : undefined;
  const requiresConfirmation =
    typeof data.requiresConfirmation === 'boolean'
      ? data.requiresConfirmation
      : undefined;
  const confirmedScheduledAt =
    convertTimestamp(data.confirmedScheduledAt) || undefined;

  const displayStatus =
    effectiveAppointmentStatus({
      status: parsedStatus,
      editScope,
      requiresConfirmation,
      confirmedScheduledAt,
      scheduledAt: instant,
      date,
      time: data.time,
    }) ?? parsedStatus;

  const teleconsult = normalizeTeleconsult(data.teleconsult);
  const postConsultActions = normalizePostConsultActions(
    data.postConsultActions ?? data.post_consult_actions
  );
  const teleconsultConsent = data.teleconsultConsent ?? data.teleconsult_consent
    ? {
        obtained: Boolean((data.teleconsultConsent ?? data.teleconsult_consent).obtained),
        at:
          convertTimestamp((data.teleconsultConsent ?? data.teleconsult_consent).at) ||
          undefined,
        by:
          typeof (data.teleconsultConsent ?? data.teleconsult_consent).by === 'string'
            ? (data.teleconsultConsent ?? data.teleconsult_consent).by
            : undefined,
      }
    : undefined;

  let status = displayStatus;
  if (
    status === 'no_show' &&
    hasConsultBeenStarted({
      status,
      teleconsult,
      postConsultActions,
    })
  ) {
    status = 'completed';
  }

  return {
    id,
    doctorId: String(data.doctorId || doctorId),
    patientId: data.patientId || 'unknown',
    patientName: data.patientName || 'Patient',
    patientEmail: data.patientEmail || '',
    type: normalizeType(data.type),
    status,
    date,
    time: normalizeAppointmentTime(data),
    scheduledAt: instant ?? undefined,
    timezone: timeZone,
    notes: data.notes || '',
    documents: normalizeAppointmentDocuments(data.documents),
    postConsultActions,
    isManual: data.isManual ?? false,
    practiceId: data.practiceId || undefined,
    locationId: data.locationId || undefined,
    consultType: data.consultType || data.consultationType || undefined,
    teleconsult,
    teleconsultConsent,
    virtualMeetingLink: typeof data.virtualMeetingLink === 'string' ? data.virtualMeetingLink : undefined,
    startAt: convertTimestamp(data.startAt) || undefined,
    endAt: convertTimestamp(data.endAt) || undefined,
    durationMinutes:
      typeof data.durationMinutes === 'number' &&
      Number.isFinite(data.durationMinutes) &&
      data.durationMinutes > 0
        ? data.durationMinutes
        : undefined,
    requestedByRole: data.requestedByRole || undefined,
    overrideApplied: data.overrideApplied ?? undefined,
    conflictMeta: data.conflictMeta || undefined,
    editScope,
    requiresConfirmation,
    confirmedScheduledAt,
    createdAt: convertTimestamp(data.createdAt) || date,
    updatedAt: convertTimestamp(data.updatedAt) || date,
  };
};

const mapDjangoAppointments = (
  rows: Array<Record<string, unknown>>,
  doctorId: string
): Appointment[] =>
  rows
    .map((row) => {
      try {
        return mapAppointmentFields(String(row.id), doctorId, row as Record<string, any>);
      } catch (error) {
        console.error('Error parsing Django appointment:', error);
        return null;
      }
    })
    .filter((row): row is Appointment => row != null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

function pollAppointments(
  load: () => Promise<Appointment[]>,
  onUpdate: (appointments: Appointment[]) => void,
  onError: (error: Error) => void,
  intervalMs = 30_000
): Unsubscribe {
  let cancelled = false;
  const poll = async () => {
    try {
      const appointments = await load();
      if (!cancelled) onUpdate(appointments);
    } catch (err) {
      if (!cancelled) {
        onError(err instanceof Error ? err : new Error('Failed to load appointments'));
      }
    }
  };
  void poll();
  const timer = setInterval(poll, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

export const migrateDoctorAppointmentsToGlobal = async (_doctorId: string): Promise<number> => {
  console.warn(
    '[appointmentService] migrateDoctorAppointmentsToGlobal is deprecated under Django API'
  );
  return 0;
};

export const getDoctorAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    const rows = await djangoListAppointments('doctor');
    return mapDjangoAppointments(rows as Array<Record<string, unknown>>, doctorId);
  } catch (error) {
    console.error('Django getDoctorAppointments failed:', error);
    throw error;
  }
};

/**
 * Live view of a doctor's appointments via 30s polling.
 */
export const listenToDoctorAppointments = (
  doctorId: string,
  onAppointmentsUpdate: (appointments: Appointment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError?.(new Error('Doctor ID is required'));
    return () => {};
  }

  return pollAppointments(
    () => getDoctorAppointments(doctorId),
    onAppointmentsUpdate,
    (error) => onError?.(error)
  );
};

/** All appointments for a clinic/practice (clinic admin schedule view). */
export const getPracticeWideAppointments = async (practiceId: string): Promise<Appointment[]> => {
  try {
    const rows = await djangoListAppointments('doctor');
    const filtered = (rows as Array<Record<string, unknown>>).filter(
      (row) => String(row.practiceId ?? '') === practiceId
    );
    return mapDjangoAppointments(filtered, 'unknown');
  } catch (error) {
    console.error('Error in getPracticeWideAppointments:', error);
    return [];
  }
};

export const getAppointmentById = async (
  doctorId: string,
  appointmentId: string
): Promise<Appointment | null> => {
  try {
    const rows = await djangoListAppointments('doctor');
    const row = (rows as Array<Record<string, unknown>>).find(
      (item) => String(item.id) === appointmentId
    );
    if (!row) return null;
    return mapAppointmentFields(appointmentId, doctorId, row as Record<string, any>);
  } catch (error) {
    console.error('Error in getAppointmentById:', error);
    throw error;
  }
};

export const createAppointment = async (
  data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    if (!data.doctorId || !data.patientName || !data.date || !data.time) {
      throw new Error('Doctor ID, patient name, date, and time are required');
    }

    const startAt =
      data.startAt ??
      data.scheduledAt ??
      resolveScheduledAt({
        date: data.date,
        time: data.time,
        startAt: data.startAt,
        scheduledAt: data.scheduledAt,
      });
    if (!startAt) {
      throw new Error('Appointment start time is required');
    }

    const durationMinutes =
      typeof data.durationMinutes === 'number' && data.durationMinutes > 0
        ? data.durationMinutes
        : data.endAt
          ? Math.max(15, Math.round((data.endAt.getTime() - startAt.getTime()) / 60_000))
          : 30;

    const booked = await djangoBookAppointment({
      doctorId: data.doctorId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientEmail: data.patientEmail,
      consultType: data.consultType,
      locationId: data.locationId,
      startAt: startAt.toISOString(),
      durationMinutes,
      status: assertAppointmentStatus(
        data.requestedByRole === 'doctor' ? 'confirmed' : data.status || 'pending'
      ),
      notes: data.notes ?? '',
      practiceId: data.practiceId,
    });

    return booked.appointmentId;
  } catch (error) {
    throw error;
  }
};

export const updateAppointment = async (
  doctorId: string,
  appointmentId: string,
  updates: Partial<Appointment>
): Promise<void> => {
  void doctorId;
  const patch: Record<string, unknown> = {};
  if (updates.status) patch.status = updates.status;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.teleconsult) patch.teleconsult = updates.teleconsult;
  if (updates.postConsultActions) patch.post_consult_actions = updates.postConsultActions;
  if (updates.teleconsultConsent) patch.teleconsult_consent = updates.teleconsultConsent;
  if (updates.type) patch.type = normalizeType(updates.type);
  if (updates.consultType) {
    patch.consultType = updates.consultType;
    patch.consultationType = updates.consultType;
  }
  if (Object.keys(patch).length > 0) {
    await djangoPatchAppointment(appointmentId, patch);
  }
};

export const syncAppointmentStatus = async (_appointmentId: string): Promise<void> => {
  console.warn('[appointmentService] syncAppointmentStatus is a no-op under Django API');
};

export const syncAllDoctorAppointments = async (_doctorId: string): Promise<void> => {
  console.warn('[appointmentService] syncAllDoctorAppointments is a no-op under Django API');
};

export const diagnoseAppointmentSync = async (
  _doctorId: string
): Promise<{
  globalCount: number;
  doctorSubCount: number;
  inconsistencies: any[];
}> => {
  console.warn('[appointmentService] diagnoseAppointmentSync is deprecated under Django API');
  return {
    globalCount: 0,
    doctorSubCount: 0,
    inconsistencies: [],
  };
};

export const getMobileAppAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    const appointments = await getDoctorAppointments(doctorId);
    return appointments
      .filter((apt) => apt.status === 'pending' || apt.status === 'confirmed')
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch (error) {
    console.error('Error loading mobile appointments:', error);
    throw error;
  }
};

/**
 * Every visit this doctor has with one patient, newest first.
 */
export const getDoctorPatientAppointments = async (
  doctorId: string,
  patientId: string
): Promise<Appointment[]> => {
  if (!doctorId || !patientId) return [];

  try {
    const rows = await djangoListAppointments('doctor');
    const filtered = (rows as Array<Record<string, unknown>>).filter(
      (row) => String(row.patientId ?? '') === patientId
    );
    return mapDjangoAppointments(filtered, doctorId);
  } catch (error) {
    console.error('[appointmentService] doctor-owned patient appointments', error);
    return [];
  }
};

export const fixInconsistentAppointments = async (): Promise<void> => {
  console.warn('[appointmentService] fixInconsistentAppointments is deprecated under Django API');
};

export const autoSyncAppointments = async (): Promise<void> => {
  // Django API is the single source of truth; no client-side sync needed.
};

export const initializeAppointmentSync = (): void => {
  // No-op under Django API.
};

export const checkAppointmentConflict = async (
  doctorId: string,
  date: Date,
  time: string,
  excludeAppointmentId?: string
): Promise<boolean> => {
  try {
    const appointments = await getDoctorAppointments(doctorId);
    const targetDay = date.toDateString();

    return appointments.some((apt) => {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;
      if (apt.date.toDateString() !== targetDay) return false;
      return apt.time === time;
    });
  } catch (error) {
    console.error('Error checking appointment conflict:', error);
    return false;
  }
};

export const addAppointmentDocument = async (
  doctorId: string,
  appointmentId: string,
  file: File,
  createdBy: string,
  title?: string
): Promise<AppointmentDocument> => {
  try {
    if (!file) throw new Error('Please select a document to upload.');
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('File is too large. Maximum size is 15MB.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const documentId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const uploaded = await djangoUploadDocument(file, 'appointment-document', safeName);

    const document: AppointmentDocument = {
      id: documentId,
      title: title?.trim() || undefined,
      fileName: file.name,
      fileType: uploaded.mimeType || file.type,
      fileSize: uploaded.sizeBytes || file.size,
      downloadURL: uploaded.url,
      storagePath: uploaded.storageKey,
      createdAt: new Date(),
      createdBy,
    };

    console.warn(
      '[appointmentService] Uploaded appointment document; persisting document lists on appointments is not yet supported by Django API',
      { doctorId, appointmentId, storageKey: uploaded.storageKey }
    );

    return document;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload scanned document';
    throw new Error(message);
  }
};
