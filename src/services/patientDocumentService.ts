import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { convertTimestamp } from '../utils/dateFormatter';

const MEDICAL_FILES_COLLECTION = 'medical_files';

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

/**
 * Documents the patients themselves uploaded in the mobile app.
 *
 * These live in the top-level `medical_files` collection owned by the patient;
 * the doctor reads the same records rather than a portal-side copy, and access
 * is enforced by the sharing rules on that collection.
 */
export const getPatientUploadedFiles = async (
  patientIds: string[]
): Promise<PatientUploadedFile[]> => {
  const ids = patientIds.filter((id) => id && !id.startsWith('manual_') && id !== 'unknown');
  if (ids.length === 0) return [];

  const snapshots = await Promise.all(
    chunk(ids, IN_QUERY_CHUNK).map((idChunk) =>
      getDocs(
        query(collection(db, MEDICAL_FILES_COLLECTION), where('userId', 'in', idChunk))
      )
    )
  );

  const files: PatientUploadedFile[] = [];
  snapshots.forEach((snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      files.push({
        id: docSnap.id,
        patientId: String(data.userId ?? ''),
        category: String(data.category ?? ''),
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
