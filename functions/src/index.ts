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

export const sendReferralInvitationCallable = functions.https.onCall(
  async (data, context) => {
    const doctorId = String(data.doctorId || '');
    const targetEmail = String(data.targetEmail || '');

    if (!doctorId || !targetEmail) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'doctorId and targetEmail are required'
      );
    }

    if (!SENDGRID_API_KEY) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'SendGrid API key is not configured'
      );
    }

    const refDoc = await db.collection('referrals').doc(doctorId).get();
    const refData = refDoc.exists ? refDoc.data() : null;
    const referralLink = refData?.referralLink || `${WEB_SIGNUP}?ref=${refData?.referralCode || doctorId}`;
    const subject = `You're invited to join Anixi`;
    const html = `
      <p>Hello,</p>
      <p>${refData?.doctorName || 'A doctor'} invited you to join Anixi — a care coordination app.</p>
      <p>Sign up on the web: <a href="${referralLink}">${referralLink}</a></p>
      <p>Or download the app:</p>
      <ul>
        <li><a href="${IOS_LINK}">Download on the App Store</a></li>
        <li><a href="${ANDROID_LINK}">Get it on Google Play</a></li>
      </ul>
      <p>If you have any trouble, reply to this email.</p>
      <p>— The Anixi team</p>
    `;

    try {
      await sgMail.send({
        to: targetEmail,
        from: FROM_EMAIL,
        subject,
        html,
      });
      return { status: 'sent' };
    } catch (error: any) {
      const message = error?.message || String(error);
      throw new functions.https.HttpsError('internal', message);
    }
  }
);

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
        const msg = '[sendReferralInvitation] SendGrid API key not configured; skipping email send';
        console.warn(msg);
        await snap.ref.update({
          status: 'failed',
          sendError: msg,
          attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      await sgMail.send({
        to: data.targetEmail,
        from: FROM_EMAIL,
        subject,
        html,
      });

      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send invite email', err);
      await snap.ref.update({
        status: 'failed',
        sendError: String(err),
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// Temporary unsecured test endpoint — remove after debugging
export const sendReferralInvitationTest = functions.https.onRequest(async (req, res) => {
  try {
    const { doctorId = '', targetEmail = '' } = req.method === 'GET' ? req.query : req.body;
    const dId = String(doctorId || '');
    const tEmail = String(targetEmail || '');
    if (!dId || !tEmail) {
      res.status(400).send('doctorId and targetEmail required');
      return;
    }

    if (!SENDGRID_API_KEY) {
      res.status(500).send('SendGrid API key not configured');
      return;
    }

    const refDoc = await db.collection('referrals').doc(dId).get();
    const refData = refDoc.exists ? refDoc.data() : null;
    const referralLink = refData?.referralLink || `${WEB_SIGNUP}?ref=${refData?.referralCode || dId}`;
    const subject = `You're invited to join Anixi`;
    const html = `\n      <p>Hello,</p>\n      <p>${refData?.doctorName || 'A doctor'} invited you to join Anixi — a care coordination app.</p>\n      <p>Sign up on the web: <a href="${referralLink}">${referralLink}</a></p>\n      <p>Or download the app:</p>\n      <ul>\n        <li><a href="${IOS_LINK}">Download on the App Store</a></li>\n        <li><a href="${ANDROID_LINK}">Get it on Google Play</a></li>\n      </ul>\n      <p>If you have any trouble, reply to this email.</p>\n      <p>— The Anixi team</p>\n    `;

    await sgMail.send({ to: tEmail, from: FROM_EMAIL, subject, html });
    res.status(200).json({ status: 'sent' });
  } catch (err: any) {
    console.error('sendReferralInvitationTest error', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});
