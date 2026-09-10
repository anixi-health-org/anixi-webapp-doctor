import { djangoCreateSharingRequest } from '../../services/djangoApiService';

export interface CreateSharingRequestInput {
  patientId: string;
  doctorId: string;
}

export const createSharingRequest = async (
  input: CreateSharingRequestInput,
): Promise<string> => {
  const { patientId, doctorId } = input;
  if (!patientId?.trim()) throw new Error('Patient ID is required');
  if (!doctorId?.trim()) throw new Error('Doctor ID is required');

  const result = await djangoCreateSharingRequest({
    clinicianId: doctorId,
    patientId,
  });
  return result.id;
};
