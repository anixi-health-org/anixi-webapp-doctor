import { djangoPatchAppointment, djangoUpdateArrivalStatus } from './djangoApiService';
import { logClinicAuditEvent } from './clinicAuditService';
import type { Appointment } from '../types';

export type ArrivalStatus = 'expected' | 'checked_in' | 'with_doctor' | 'completed';

type AuditContext = {
  practiceId?: string;
  actorUid?: string;
  actorName?: string;
};

export async function updateAppointmentArrivalStatus(
  appointmentId: string,
  arrivalStatus: ArrivalStatus,
  checkedInBy?: string,
  audit?: AuditContext,
): Promise<void> {
  void audit;
  try {
    await djangoUpdateArrivalStatus(appointmentId, arrivalStatus, checkedInBy);
  } catch (error) {
    if (error instanceof Error && error.message.includes('failed')) {
      throw error;
    }
  }
  // Arrival audit entries are persisted server-side when the Django API updates status.
}

export async function updateAppointmentRoom(
  appointmentId: string,
  roomId: string | null,
  audit?: AuditContext & { roomName?: string },
): Promise<void> {
  await djangoPatchAppointment(appointmentId, { roomId: roomId || '' });
  if (audit?.practiceId && audit?.actorUid) {
    await logClinicAuditEvent({
      practiceId: audit.practiceId,
      action: 'queue.room_assigned',
      actorUid: audit.actorUid,
      actorName: audit.actorName,
      targetType: 'appointment',
      targetId: appointmentId,
      summary: roomId
        ? `Assigned to room ${audit.roomName ?? roomId}`
        : 'Room assignment cleared',
      metadata: { roomId },
    });
  }
}

export function arrivalStatusLabel(status?: ArrivalStatus | string): string {
  switch (status) {
    case 'checked_in':
      return 'Checked in';
    case 'with_doctor':
      return 'With doctor';
    case 'completed':
      return 'Completed';
    default:
      return 'Expected';
  }
}

export function isTodayAppointment(appointment: Appointment): boolean {
  const date = appointment.scheduledAt || appointment.date;
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  const tz = appointment.timezone || 'Africa/Johannesburg';
  const now = new Date();
  const key = (instant: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  return key(d) === key(now);
}
