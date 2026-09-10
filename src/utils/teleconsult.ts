import { Appointment } from '../types';

function consultCategory(appointment: Appointment): string {
  const record = appointment as Appointment & { consultationType?: string };
  return String(appointment.consultType ?? record.consultationType ?? '').toLowerCase();
}

function teleconsultRecord(appointment: Appointment) {
  return appointment.teleconsult ?? null;
}

/** True when a LiveKit session was opened for this visit (joined, waiting, or still marked in progress). */
export function hasOpenTeleconsultSession(appointment: Appointment): boolean {
  const teleconsult = teleconsultRecord(appointment);
  if (!teleconsult) return false;
  const status = String(teleconsult.status ?? '').toLowerCase();
  if (status === 'in_progress' || status === 'waiting') return true;
  if (teleconsult.doctorJoinedAt || teleconsult.patientJoinedAt) return true;
  if (teleconsult.provider === 'livekit' && teleconsult.roomName) return true;
  return false;
}

export function isTeleconsultEnded(appointment: Appointment): boolean {
  return String(teleconsultRecord(appointment)?.status ?? '').toLowerCase() === 'ended';
}

const CLOSED_VISIT_STATUSES = new Set([
  'cancelled',
  'auto_cancelled',
  'no_show',
  'completed',
]);

export function isVisitClosed(appointment: Appointment): boolean {
  return CLOSED_VISIT_STATUSES.has(String(appointment.status ?? ''));
}

/** Virtual / video teleconsult that can join LiveKit (not WhatsApp/Phone). */
export function isJoinableTeleconsult(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return false;
  const consult = consultCategory(appointment);
  if (consult === 'whatsapp' || consult === 'phone') return false;

  // An already-started LiveKit visit stays joinable even if type/consultType
  // were lost or mis-normalized on one of the appointment copies.
  if (hasOpenTeleconsultSession(appointment) || isTeleconsultEnded(appointment)) {
    return true;
  }

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
  if (isVisitClosed(appointment) && !hasOpenTeleconsultSession(appointment)) {
    return false;
  }
  // Ended sessions can still be restarted until the visit itself is closed.
  return true;
}

/** Doctor can start or rejoin LiveKit for real video teleconsults (not in-clinic). */
export function canDoctorStartVideoCall(appointment: Appointment): boolean {
  if (isWhatsAppComingSoon(appointment)) return false;
  if (!isJoinableTeleconsult(appointment)) return false;

  // Active call, always allow rejoin, even if appointment status raced to no_show.
  if (hasOpenTeleconsultSession(appointment)) return true;

  if (isVisitClosed(appointment)) return false;

  // Call was ended but the visit is still open, doctor may restart.
  return true;
}

export function isWhatsAppComingSoon(_appointment: Appointment): boolean {
  return false;
}

export function isWhatsAppConsult(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return false;
  const consult = consultCategory(appointment);
  return consult === 'whatsapp';
}

export function isPhoneConsult(appointment: Appointment): boolean {
  if (appointment.type === 'Phone') return true;
  return consultCategory(appointment) === 'phone';
}

export function whatsAppDeepLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('27') ? digits : `27${digits.replace(/^0/, '')}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${text}`;
}

export function phoneDeepLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('27') ? `+${digits}` : `+27${digits.replace(/^0/, '')}`;
  return `tel:${normalized}`;
}

export function formatAppointmentTypeLabel(appointment: Appointment): string {
  if (isWhatsAppConsult(appointment)) return 'WhatsApp consult';
  if (isPhoneConsult(appointment)) return 'Phone consult';

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
    virtual: 'Virtual / video',
    'in-practice': 'In clinic',
    'in-person': 'In clinic',
    inpractice: 'In clinic',
    inperson: 'In clinic',
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
