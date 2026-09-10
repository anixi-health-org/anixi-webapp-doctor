export interface CareMessage {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  body: string;
  createdAt: Date;
}

export const getDoctorCareMessages = async (_doctorId: string): Promise<CareMessage[]> => {
  // TODO: wire to Django care-messages endpoint once available.
  return [];
};

export const getPatientCareMessages = async (
  _doctorId: string,
  _patientId: string,
): Promise<CareMessage[]> => {
  // TODO: wire to Django care-messages endpoint once available.
  return [];
};

export const sendCareMessage = async (
  _doctorId: string,
  _patientId: string,
  _patientName: string,
  body: string,
): Promise<string> => {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length < 2) throw new Error('Message is too short');
  // TODO: persist via Django care-messages endpoint once available.
  return `care-message-${Date.now()}`;
};
