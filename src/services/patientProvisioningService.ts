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

/**
 * Auth-user provisioning is intentionally not implemented on the client.
 * Creating Firebase Auth users requires Admin credentials and must live in a
 * Cloud Function. Until that function exists, invite the patient to sign up
 * themselves via the existing mail-queue referral flow.
 */
export async function provisionPatientAccount(
  _input: ProvisionPatientAccountInput
): Promise<ProvisionPatientAccountResult> {
  throw new Error(
    'Patient Auth provisioning is not available from the client. Invite the patient to create their own Anixi account, then link them after they sign up.'
  );
}
