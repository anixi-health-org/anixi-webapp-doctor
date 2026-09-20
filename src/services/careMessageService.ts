import {
  djangoListCareMessages,
  djangoSendCareMessage,
  isDjangoApiEnabled,
} from './djangoApiService';

export interface CareMessage {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  body: string;
  createdAt: Date;
}

function mapCareMessage(row: Record<string, unknown>): CareMessage {
  return {
    id: String(row.id ?? ''),
    doctorId: String(row.doctorId ?? ''),
    patientId: String(row.patientId ?? ''),
    patientName: String(row.patientName ?? 'Patient'),
    body: String(row.body ?? ''),
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
  };
}

export const getDoctorCareMessages = async (_doctorId: string): Promise<CareMessage[]> => {
  if (!isDjangoApiEnabled()) return [];
  const rows = await djangoListCareMessages();
  return rows.map(mapCareMessage);
};

export const getPatientCareMessages = async (
  doctorId: string,
  patientId: string,
): Promise<CareMessage[]> => {
  const rows = await getDoctorCareMessages(doctorId);
  return rows.filter((row) => row.patientId === patientId);
};

export const sendCareMessage = async (
  _doctorId: string,
  patientId: string,
  _patientName: string,
  body: string,
): Promise<string> => {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length < 2) throw new Error('Message is too short');
  if (!isDjangoApiEnabled()) {
    throw new Error('Care messages require the Django API.');
  }
  const result = await djangoSendCareMessage({ patientId, body: trimmed });
  return String(result.id ?? '');
};
