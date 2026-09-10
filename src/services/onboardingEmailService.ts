import { djangoSendTransactionalEmail, isDjangoApiEnabled } from './djangoApiService';

/** Sent when a doctor submits their HPCSA profile for admin review. */
export async function queueDoctorOnboardingSubmittedEmail(opts: {
  to: string;
  displayName?: string;
}): Promise<void> {
  if (isDjangoApiEnabled()) {
    await djangoSendTransactionalEmail('doctor_onboarding_submitted', opts.to, {
      displayName: opts.displayName ?? '',
    });
    return;
  }

  // Firestore trigger-email path removed.
  console.log(
    '[onboardingEmailService] queueDoctorOnboardingSubmittedEmail stub — to=' +
      opts.to,
  );
}

/** Sent when a clinic finishes setup to pending staff invites. */
export async function queueClinicLiveStaffReminderEmail(opts: {
  to: string;
  displayName?: string;
  practiceName: string;
  acceptUrl: string;
  role: string;
}): Promise<void> {
  if (isDjangoApiEnabled()) {
    await djangoSendTransactionalEmail('clinic_live_staff_reminder', opts.to, {
      displayName: opts.displayName ?? '',
      practiceName: opts.practiceName,
      role: opts.role,
      acceptUrl: opts.acceptUrl,
    });
    return;
  }

  // Firestore trigger-email path removed.
  console.log(
    '[onboardingEmailService] queueClinicLiveStaffReminderEmail stub — to=' +
      opts.to,
  );
}
