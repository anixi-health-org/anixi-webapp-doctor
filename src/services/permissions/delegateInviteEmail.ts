import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const TRIGGER_EMAIL_COLLECTION =
  (process.env.REACT_APP_TRIGGER_EMAIL_COLLECTION || '').trim() || 'mail';

const WEB_APP_URL =
  (process.env.REACT_APP_WEB_APP_URL || process.env.REACT_APP_WEB_SIGNUP_URL || '').trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://app.anixi.health');

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const buildDelegateAcceptUrl = (doctorId: string, delegateId: string): string => {
  const url = new URL('/delegate/accept', WEB_APP_URL);
  url.searchParams.set('doctorId', doctorId);
  url.searchParams.set('delegateId', delegateId);
  return url.toString();
};

export const queueDelegateInvitationEmail = async (opts: {
  to: string;
  doctorName: string;
  doctorId: string;
  delegateId: string;
}): Promise<string> => {
  const acceptUrl = buildDelegateAcceptUrl(opts.doctorId, opts.delegateId);
  const subject = `${opts.doctorName} invited you to their Anixi practice`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>Hello,</p>
      <p><strong>${escapeHtml(opts.doctorName)}</strong> has invited you to join their practice on Anixi Health as a delegate.</p>
      <p><a href="${acceptUrl}">Accept invitation</a></p>
      <p>Or copy this link: ${acceptUrl}</p>
      <p>If you did not expect this invitation, you can ignore this email.</p>
      <p>- The Anixi team</p>
    </div>
  `.trim();

  const mailDoc = await addDoc(collection(db, TRIGGER_EMAIL_COLLECTION), {
    to: [opts.to.trim()],
    message: { subject, html },
    meta: {
      type: 'delegate_invitation',
      doctorId: opts.doctorId,
      delegateId: opts.delegateId,
    },
    createdAt: serverTimestamp(),
  });

  return mailDoc.id;
};
