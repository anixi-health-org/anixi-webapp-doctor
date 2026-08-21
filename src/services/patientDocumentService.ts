import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { convertTimestamp } from '../utils/dateFormatter';
import {
  canAccessMedicalFileCategory,
  type MedicalRecordScope,
} from './medicalRecordShareAccess';

const MEDICAL_FILES_COLLECTION = 'medical_files';
const USERS_COLLECTION = 'Users';

/** Firestore `in` filters accept at most 30 values. */
const IN_QUERY_CHUNK = 10;

export interface PatientUploadedFile {
  id: string;
  patientId: string;
  category: string;
  name: string;
  url: string;
  mimeType: string;
  uploadedAt: Date | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  xrays: 'X-ray',
  blood_tests: 'Blood test',
  notes: 'Patient note',
};

export const patientFileCategoryLabel = (category: string): string =>
  CATEGORY_LABELS[category] ?? 'Document';

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/** Scope keys map onto the `category` field stored on each medical file. */
const SCOPE_TO_FILE_CATEGORY: Array<[keyof MedicalRecordScope, string]> = [
  ['xrays', 'xrays'],
  ['bloodTests', 'blood_tests'],
  ['notes', 'notes'],
];

async function resolvePatientFileAccess(patientId: string, doctorId: string) {
  const [approvedShareSnap, approvedPatientSnap, approvedDoctorSnap] =
    await Promise.all([
      getDoc(doc(db, USERS_COLLECTION, patientId, 'approved_shares', doctorId)),
      getDoc(doc(db, USERS_COLLECTION, doctorId, 'approved_patients', patientId)),
      getDoc(doc(db, USERS_COLLECTION, patientId, 'approved_doctors', doctorId)),
    ]);

  const approvedDoctorActive =
    approvedDoctorSnap.exists() &&
    (approvedDoctorSnap.data()?.status == null ||
      approvedDoctorSnap.data()?.status === 'active');

  if (
    approvedShareSnap.exists() ||
    approvedPatientSnap.exists() ||
    approvedDoctorActive
  ) {
    return {
      hasApprovedShareConnection: true,
      scope: null as Partial<MedicalRecordScope> | null,
      status: 'approved',
      expiresAt: null as Date | null,
    };
  }

  const accessSnap = await getDoc(
    doc(db, USERS_COLLECTION, patientId, 'medical_record_access', doctorId),
  );
  if (!accessSnap.exists()) {
    return {
      hasApprovedShareConnection: false,
      scope: null,
      status: 'none',
      expiresAt: null as Date | null,
    };
  }

  const data = accessSnap.data();
  return {
    hasApprovedShareConnection: false,
    scope: (data.scope ?? null) as Partial<MedicalRecordScope> | null,
    status: String(data.status ?? ''),
    expiresAt: convertTimestamp(data.expiresAt),
  };
}

/**
 * Documents the patients themselves uploaded in the mobile app.
 *
 * These live in the top-level `medical_files` collection owned by the patient;
 * the doctor reads the same records rather than a portal-side copy.
 * Access is enforced by Firestore rules AND filtered here by share scope.
 */
export const getPatientUploadedFiles = async (
  patientIds: string[]
): Promise<PatientUploadedFile[]> => {
  const ids = patientIds.filter((id) => id && !id.startsWith('manual_') && id !== 'unknown');
  if (ids.length === 0) return [];

  const doctorId = auth.currentUser?.uid;
  if (!doctorId) return [];

  const accessByPatient = new Map<
    string,
    Awaited<ReturnType<typeof resolvePatientFileAccess>>
  >();
  await Promise.all(
    ids.map(async (patientId) => {
      accessByPatient.set(
        patientId,
        await resolvePatientFileAccess(patientId, doctorId),
      );
    }),
  );

  // Patients with a full connection allow reading every file, so they can be
  // batched. Scoped shares must be queried per allowed category: security rules
  // reject the whole query if it would return a single out-of-scope document.
  const fullAccessIds: string[] = [];
  const scopedRequests: Array<{ patientId: string; category: string }> = [];

  ids.forEach((patientId) => {
    const access = accessByPatient.get(patientId);
    if (!access) return;
    if (access.hasApprovedShareConnection) {
      fullAccessIds.push(patientId);
      return;
    }
    if (access.status !== 'approved') return;
    SCOPE_TO_FILE_CATEGORY.forEach(([scopeKey, category]) => {
      if (access.scope?.[scopeKey] === true) {
        scopedRequests.push({ patientId, category });
      }
    });
  });

  const snapshots = await Promise.all([
    ...chunk(fullAccessIds, IN_QUERY_CHUNK).map((idChunk) =>
      getDocs(
        query(collection(db, MEDICAL_FILES_COLLECTION), where('userId', 'in', idChunk))
      )
    ),
    ...scopedRequests.map((request) =>
      getDocs(
        query(
          collection(db, MEDICAL_FILES_COLLECTION),
          where('userId', '==', request.patientId),
          where('category', '==', request.category)
        )
      )
    ),
  ]);

  const files: PatientUploadedFile[] = [];
  const seen = new Set<string>();
  snapshots.forEach((snapshot) => {
    snapshot.forEach((docSnap) => {
      if (seen.has(docSnap.id)) return;
      seen.add(docSnap.id);
      const data = docSnap.data();
      const patientId = String(data.userId ?? '');
      const category = String(data.category ?? '');
      const access = accessByPatient.get(patientId);
      if (
        !access ||
        !canAccessMedicalFileCategory({
          hasApprovedShareConnection: access.hasApprovedShareConnection,
          scope: access.scope,
          status: access.status,
          expiresAt: access.expiresAt,
          category,
        })
      ) {
        return;
      }

      files.push({
        id: docSnap.id,
        patientId,
        category,
        name: String(data.name ?? 'Document'),
        url: String(data.url ?? ''),
        mimeType: String(data.mimeType ?? ''),
        uploadedAt: convertTimestamp(data.uploadedAt),
      });
    });
  });

  return files.sort(
    (a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0)
  );
};
