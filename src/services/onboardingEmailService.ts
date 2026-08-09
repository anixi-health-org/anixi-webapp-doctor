import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const TRIGGER_EMAIL_COLLECTION =
  (process.env.REACT_APP_TRIGGER_EMAIL_COLLECTION || '').trim() || 'mail';

async function queueTriggerEmail(payload: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}): Promise<void> {
  const to = payload.to.trim();
  if (!to) return;

  await addDoc(collection(db, TRIGGER_EMAIL_COLLECTION), {
    to: [to],
    message: {
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    },
    meta: payload.meta || {},
    createdAt: serverTimestamp(),
  });
}

/** Sent when a doctor submits their HPCSA profile for admin review. */
export async function queueDoctorOnboardingSubmittedEmail(opts: {
  to: string;
  displayName?: string;
}): Promise<void> {
  const name = opts.displayName?.trim() || 'Doctor';
  await queueTriggerEmail({
    to: opts.to,
    subject: 'Anixi Health: profile submitted for review',
    html: `
      <p>Hello ${name},</p>
      <p>We received your professional profile and HPCSA details. Our team will review your application shortly.</p>
      <p>You can sign in to the doctor portal anytime to check your status. We will email you once your account is approved.</p>
      <p>— The Anixi Health team</p>
    `.trim(),
    text: 'Your Anixi Health doctor profile was submitted for review. We will email you when it is approved.',
    meta: { type: 'doctor_onboarding_submitted' },
  });
}

/** Sent when a clinic finishes setup to pending staff invites. */
export async function queueClinicLiveStaffReminderEmail(opts: {
  to: string;
  displayName?: string;
  practiceName: string;
  acceptUrl: string;
  role: string;
}): Promise<void> {
  const hello = opts.displayName ? `Hello ${opts.displayName},` : 'Hello,';
  await queueTriggerEmail({
    to: opts.to,
    subject: `${opts.practiceName} is now live on Anixi Health`,
    html: `
      <p>${hello}</p>
      <p><strong>${opts.practiceName}</strong> has finished clinic setup on Anixi Health.</p>
      <p>Your role: <strong>${opts.role.replace(/_/g, ' ')}</strong>.</p>
      <p><a href="${opts.acceptUrl}">Accept your invitation and complete onboarding</a></p>
      <p>Steps after accepting:</p>
      <ol>
        <li>Create your password</li>
        <li>Complete your professional profile (doctors)</li>
        <li>Sign in to the clinic portal</li>
      </ol>
      <p>If the link does not work, copy and paste: ${opts.acceptUrl}</p>
      <p>— The Anixi Health team</p>
    `.trim(),
    meta: { type: 'clinic_live_staff_reminder', practiceName: opts.practiceName },
  });
}
