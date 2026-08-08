import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../lib/firebase';

const functions = getFunctions(app, 'europe-west1');

export type ProvisionPatientAccountInput = {
  displayName: string;
  email: string;
  phoneNumber?: string;
  practiceId?: string;
  clinicName?: string;
};

export type ProvisionPatientAccountResult = {
  patientId: string;
  inviteQueued: boolean;
  existingAccount: boolean;
};

export async function provisionPatientAccount(
  input: ProvisionPatientAccountInput
): Promise<ProvisionPatientAccountResult> {
  const callable = httpsCallable<
    ProvisionPatientAccountInput,
    ProvisionPatientAccountResult
  >(functions, 'provisionPatientAccount');

  const result = await callable(input);
  return result.data;
}
