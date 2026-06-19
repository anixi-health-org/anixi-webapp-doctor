import { DOCTORS_COLLECTION, USERS_COLLECTION } from './constants';

export const SHARING_REQUESTS_SUBCOLLECTION = 'sharing_requests';
export const INCOMING_SHARING_REQUESTS_SUBCOLLECTION = 'incoming_sharing_requests';
export const APPROVED_SHARES_SUBCOLLECTION = 'approved_shares';
export const APPROVED_PATIENTS_SUBCOLLECTION = 'approved_patients';
export const PRACTICE_PERMISSIONS_SUBCOLLECTION = 'practice_permissions';
export const PRACTICE_PERMISSIONS_DOC_ID = 'permissions';

export const practicePermissionsPath = (doctorId: string) =>
  `${USERS_COLLECTION}/${doctorId}/${PRACTICE_PERMISSIONS_SUBCOLLECTION}/${PRACTICE_PERMISSIONS_DOC_ID}`;

export const legacyPracticePermissionsPath = (doctorId: string) =>
  `${DOCTORS_COLLECTION}/${doctorId}/settings/permissions`;
