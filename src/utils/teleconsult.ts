import { Appointment } from '../types';

/** Virtual / video teleconsult that can join LiveKit (not WhatsApp/Phone). */
export function isJoinableTeleconsult(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return false;
  const consult = String(appointment.consultType ?? '').toLowerCase();
  if (consult === 'whatsapp' || consult === 'phone') return false;
  return (
    appointment.type === 'Virtual' ||
    consult === 'teleconsult' ||
    consult === 'telehealth' ||
    consult === 'video'
  );
}

export function canJoinTeleconsult(appointment: Appointment): boolean {
  if (!isJoinableTeleconsult(appointment)) return false;
  return !['cancelled', 'no_show', 'completed'].includes(appointment.status);
}

/** Doctor can start a video visit from the briefing desk for any active appointment. */
export function canDoctorStartVideoCall(appointment: Appointment): boolean {
  if (isWhatsAppComingSoon(appointment)) return false;
  return !['cancelled', 'no_show', 'completed'].includes(appointment.status);
}

export function isWhatsAppComingSoon(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return true;
  const consult = String(appointment.consultType ?? '').toLowerCase();
  return consult === 'whatsapp' || consult === 'phone';
}

export function formatAppointmentTypeLabel(appointment: Appointment): string {
  if (isWhatsAppComingSoon(appointment)) return 'WhatsApp (Coming soon)';

  const consult = String(appointment.consultType ?? '').toLowerCase();
  const consultLabels: Record<string, string> = {
    initial: 'Initial Consultation',
    'follow-up': 'Follow-up',
    followup: 'Follow-up',
    urgent: 'Urgent',
    procedure: 'Procedure',
    teleconsult: 'Virtual / video',
    telehealth: 'Virtual / video',
    video: 'Virtual / video',
    other: 'Other',
  };
  if (consult && consultLabels[consult]) return consultLabels[consult];

  if (isJoinableTeleconsult(appointment)) return 'Virtual / video';
  if (appointment.type === 'Follow-up') return 'Follow-up';
  if (appointment.type === 'Virtual') return 'Virtual / video';
  if (appointment.type === 'Phone') return 'Phone';
  return appointment.type || 'In-Person';
}

/** Maps consult category → appointment modality stored on `type`. */
export function modalityFromConsultType(
  consultType: string | undefined
): Appointment['type'] {
  const consult = String(consultType ?? '').toLowerCase();
  if (consult === 'teleconsult' || consult === 'telehealth' || consult === 'video') {
    return 'Virtual';
  }
  if (consult === 'whatsapp' || consult === 'phone') return 'Phone';
  if (consult === 'follow-up' || consult === 'followup') return 'Follow-up';
  return 'In-Person';
}
