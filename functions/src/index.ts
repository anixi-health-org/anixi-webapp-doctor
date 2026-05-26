import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = functions.config().sendgrid?.key || process.env.SENDGRID_API_KEY;
const FROM_EMAIL = functions.config().invite?.from || process.env.INVITE_FROM_EMAIL || 'no-reply@anixi.app';
const IOS_LINK = functions.config().invite?.ios || process.env.IOS_DOWNLOAD_LINK || 'https://apps.apple.com';
const ANDROID_LINK = functions.config().invite?.android || process.env.ANDROID_DOWNLOAD_LINK || 'https://play.google.com';
const WEB_SIGNUP = functions.config().invite?.web || process.env.WEB_SIGNUP_URL || 'https://app.anixi.health/sign-up';

if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

export const sendReferralInvitation = functions.firestore
  .document('referrals/{doctorId}/invitations/{invId}')
  .onCreate(async (snap, context) => {
    const { doctorId } = context.params as any;
    const data = snap.data() as any;
    if (!data) return;
    if (data.method !== 'email' || !data.targetEmail) return;

    // load referral link/code
    const refDoc = await db.collection('referrals').doc(doctorId).get();
    const refData = refDoc.exists ? refDoc.data() : null;
    const referralLink = refData?.referralLink || `${WEB_SIGNUP}?ref=${refData?.referralCode || doctorId}`;

    const inviteUrl = referralLink;
    const subject = `You're invited to join Anixi`;
    const html = `
      <p>Hello,</p>
      <p>${refData?.doctorName || 'A doctor'} invited you to join Anixi — a care coordination app.</p>
      <p>Sign up on the web: <a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Or download the app:</p>
      <ul>
        <li><a href="${IOS_LINK}">Download on the App Store</a></li>
        <li><a href="${ANDROID_LINK}">Get it on Google Play</a></li>
      </ul>
      <p>If you have any trouble, reply to this email.</p>
      <p>— The Anixi team</p>
    `;

    try {
      if (!SENDGRID_API_KEY) {
        console.warn('[sendReferralInvitation] no sendgrid key configured; skipping email send');
      } else {
        await sgMail.send({
          to: data.targetEmail,
          from: FROM_EMAIL,
          subject,
          html,
        });
      }

      await snap.ref.update({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error('Failed to send invite email', err);
      await snap.ref.update({ sendError: String(err) });
    }
  });
