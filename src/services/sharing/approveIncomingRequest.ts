import { djangoResolveSharing } from '../../services/djangoApiService';

export const approveIncomingRequest = async (
  _doctorId: string,
  requestId: string,
  _patientId: string,
): Promise<void> => {
  if (!requestId) {
    throw new Error('Request ID is required');
  }
  await djangoResolveSharing(requestId, 'approved');
};

export const rejectIncomingRequest = async (
  _doctorId: string,
  requestId: string,
  _patientId: string,
): Promise<void> => {
  if (!requestId) {
    throw new Error('Request ID is required');
  }
  await djangoResolveSharing(requestId, 'rejected');
};
