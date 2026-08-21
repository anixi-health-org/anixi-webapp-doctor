import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { convertTimestamp } from '../utils/dateFormatter';
import {
  computeShareExpiresAt,
  isSharePermissionActive,
  type AccessDurationPreset,
  type MedicalRecordScope,
} from './medicalRecordShareAccess';

const MEDICAL_RECORD_SHARES_COLLECTION = 'medical_record_shares';
const USERS_COLLECTION = 'Users';
const MEDICAL_RECORD_ACCESS_SUBCOLLECTION = 'medical_record_access';

export interface SharedRecordGrant {
  shareId: string;
  patientId: string;
  patientName: string;
  scope: Partial<MedicalRecordScope> | null;
  expiresAt: Date | null;
}

/**
 * Patients who granted this doctor a scoped medical-record share.
 *
 * These are distinct from the doctor's own roster (`approved_patients`): a
 * patient can share records without ever being a connected patient, so any
 * view that only reads the roster misses them entirely.
 */
export const getPatientsSharingRecords = async (
  doctorId: string
): Promise<SharedRecordGrant[]> => {
  if (!doctorId) return [];

  try {
    const snapshot = await getDocs(
      query(
        collection(db, MEDICAL_RECORD_SHARES_COLLECTION),
        where('doctorId', '==', doctorId),
        where('status', '==', 'approved')
      )
    );

    const grants: SharedRecordGrant[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const patientId = String(data.patientId ?? '');
      if (!patientId) return;

      const expiresAt = convertTimestamp(data.expiresAt);
      // An approved share that has passed its expiry grants nothing.
      if (!isSharePermissionActive({ status: 'approved', expiresAt })) return;

      grants.push({
        shareId: docSnap.id,
        patientId,
        patientName: String(data.patientName ?? '').trim(),
        scope: (data.scope ?? null) as Partial<MedicalRecordScope> | null,
        expiresAt,
      });
    });

    return grants;
  } catch (error) {
    console.error('[medicalRecordShareService] getPatientsSharingRecords', error);
    return [];
  }
};

export interface PendingRecordShareRequest {
  shareId: string;
  patientId: string;
  patientName: string;
  scope: Partial<MedicalRecordScope> | null;
  shareAll: boolean;
  durationPreset: AccessDurationPreset;
  customDurationDays: number | null;
  patientMessage: string | null;
  requestedAt: Date | null;
}

const toPendingRequest = (
  shareId: string,
  data: Record<string, unknown>
): PendingRecordShareRequest => ({
  shareId,
  patientId: String(data.patientId ?? ''),
  patientName: String(data.patientName ?? '').trim() || 'Patient',
  scope: (data.scope ?? null) as Partial<MedicalRecordScope> | null,
  shareAll: data.shareAll === true,
  durationPreset: (data.durationPreset as AccessDurationPreset) ?? '30_days',
  customDurationDays:
    typeof data.customDurationDays === 'number' ? data.customDurationDays : null,
  patientMessage: String(data.patientMessage ?? '').trim() || null,
  requestedAt: convertTimestamp(data.requestedAt) ?? convertTimestamp(data.createdAt),
});

const byNewestFirst = (
  a: PendingRecordShareRequest,
  b: PendingRecordShareRequest
) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0);

/**
 * Record-sharing requests waiting on this doctor's decision.
 *
 * Patients raise these from the mobile app; until the doctor approves, nothing
 * is readable, so the request has to surface somewhere in the portal.
 */
export const listenToPendingRecordShares = (
  doctorId: string,
  onChange: (requests: PendingRecordShareRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  return onSnapshot(
    query(
      collection(db, MEDICAL_RECORD_SHARES_COLLECTION),
      where('doctorId', '==', doctorId),
      where('status', '==', 'pending')
    ),
    (snapshot) => {
      const requests: PendingRecordShareRequest[] = [];
      snapshot.forEach((docSnap) => {
        const request = toPendingRequest(docSnap.id, docSnap.data());
        if (request.patientId) requests.push(request);
      });
      onChange(requests.sort(byNewestFirst));
    },
    (error) => {
      console.error('[medicalRecordShareService] listenToPendingRecordShares', error);
      onError?.(error);
    }
  );
};

const loadPendingShare = async (shareId: string, doctorId: string) => {
  const ref = doc(db, MEDICAL_RECORD_SHARES_COLLECTION, shareId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('This sharing request no longer exists.');
  }

  const data = snap.data();
  if (data.doctorId !== doctorId) {
    throw new Error('This sharing request was sent to another doctor.');
  }
  if (data.status !== 'pending') {
    throw new Error('This request has already been answered.');
  }

  return { ref, data };
};

const auditEvent = (type: string, by: string, note?: string) => ({
  type,
  at: new Date(),
  by,
  ...(note ? { note } : {}),
});

/**
 * The denormalized grant the security rules read on every record access.
 * Without it an approved share still resolves to permission-denied.
 */
const accessGrantRef = (patientId: string, doctorId: string) =>
  doc(
    db,
    USERS_COLLECTION,
    patientId,
    MEDICAL_RECORD_ACCESS_SUBCOLLECTION,
    doctorId
  );

export const approveRecordShareRequest = async (params: {
  shareId: string;
  doctorId: string;
}): Promise<void> => {
  const { ref, data } = await loadPendingShare(params.shareId, params.doctorId);

  const approvedAt = new Date();
  const expiresAt = computeShareExpiresAt(
    (data.durationPreset as AccessDurationPreset) ?? '30_days',
    approvedAt,
    typeof data.customDurationDays === 'number' ? data.customDurationDays : null
  );

  await updateDoc(ref, {
    status: 'approved',
    approvedAt: Timestamp.fromDate(approvedAt),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    reviewedBy: params.doctorId,
    updatedAt: serverTimestamp(),
    auditTrail: arrayUnion(auditEvent('ACCESS_APPROVED', params.doctorId)),
  });

  await setDoc(accessGrantRef(String(data.patientId), params.doctorId), {
    shareId: params.shareId,
    patientId: data.patientId,
    doctorId: params.doctorId,
    status: 'approved',
    scope: data.scope ?? {},
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    approvedAt: Timestamp.fromDate(approvedAt),
    updatedAt: serverTimestamp(),
  });
};

export const declineRecordShareRequest = async (params: {
  shareId: string;
  doctorId: string;
  reason?: string;
}): Promise<void> => {
  const { ref, data } = await loadPendingShare(params.shareId, params.doctorId);
  const reason = params.reason?.trim() || null;

  await updateDoc(ref, {
    status: 'declined',
    declinedAt: serverTimestamp(),
    reviewedBy: params.doctorId,
    declineReason: reason,
    updatedAt: serverTimestamp(),
    auditTrail: arrayUnion(
      auditEvent('ACCESS_DECLINED', params.doctorId, reason ?? undefined)
    ),
  });

  await deleteDoc(accessGrantRef(String(data.patientId), params.doctorId)).catch(
    () => undefined
  );
};
