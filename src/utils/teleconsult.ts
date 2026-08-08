import { Appointment } from '../types';

function consultCategory(appointment: Appointment): string {
  const record = appointment as Appointment & { consultationType?: string };
  return String(appointment.consultType ?? record.consultationType ?? '').toLowerCase();
}

/** Virtual / video teleconsult that can join LiveKit (not WhatsApp/Phone). */
export function isJoinableTeleconsult(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return false;
  const consult = consultCategory(appointment);
  if (consult === 'whatsapp' || consult === 'phone') return false;
  return (
    appointment.type === 'Virtual' ||
    consult === 'teleconsult' ||
    consult === 'telehealth' ||
    consult === 'video' ||
    consult === 'virtual'
  );
}

export function canJoinTeleconsult(appointment: Appointment): boolean {
  if (!isJoinableTeleconsult(appointment)) return false;
  if (appointment.teleconsult?.status === 'ended') return false;
  return !['cancelled', 'no_show', 'completed'].includes(appointment.status);
}

/** Doctor can start LiveKit only for real video teleconsults (not in-clinic). */
export function canDoctorStartVideoCall(appointment: Appointment): boolean {
  if (isWhatsAppComingSoon(appointment)) return false;
  if (!isJoinableTeleconsult(appointment)) return false;
  if (appointment.teleconsult?.status === 'ended') return false;
  return !['cancelled', 'no_show', 'completed'].includes(appointment.status);
}

export function isWhatsAppComingSoon(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return true;
  const consult = consultCategory(appointment);
  return consult === 'whatsapp' || consult === 'phone';
}

export function formatAppointmentTypeLabel(appointment: Appointment): string {
  if (isWhatsAppComingSoon(appointment)) return 'WhatsApp (Coming soon)';

  const consult = consultCategory(appointment);
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
