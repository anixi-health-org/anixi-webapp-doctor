import { djangoSendTransactionalEmail } from '../djangoApiService';

const WEB_APP_URL =
  (process.env.REACT_APP_WEB_APP_URL || process.env.REACT_APP_WEB_SIGNUP_URL || '').trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://doctor.anixihealth.com');

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
  await djangoSendTransactionalEmail('delegate_invitation', opts.to, {
    doctorName: opts.doctorName,
    acceptUrl,
  });
  return `django-${opts.delegateId}`;
};

export { escapeHtml };
