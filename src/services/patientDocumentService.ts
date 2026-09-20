import {
  djangoListMedicalFiles,
  djangoMediaUrlToStorageKey,
} from './djangoApiService';
import {
  formatMedicalFileSubtitle,
  formatMedicalFileTitle,
} from '../lib/medicalFileDisplay';
import { mapInBatches } from '../utils/asyncBatch';

export interface PatientUploadedFile {
  id: string;
  patientId: string;
  category: string;
  name: string;
  subtitle: string;
  url: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  uploadedAt: Date | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  xrays: 'X-ray',
  blood_tests: 'Blood test',
  notes: 'Patient note',
};

export const patientFileCategoryLabel = (category: string): string =>
  CATEGORY_LABELS[category] ?? 'Document';

/**
 * Patient-uploaded medical files via Django documents API.
 */
export const getPatientUploadedFiles = async (
  patientIds: string[],
): Promise<PatientUploadedFile[]> => {
  const ids = patientIds.filter((id) => id && !id.startsWith('manual_') && id !== 'unknown');
  if (ids.length === 0) return [];

  const snapshots = await mapInBatches(ids, 6, async (patientId) => {
    try {
      return await djangoListMedicalFiles(patientId);
    } catch (error) {
      console.warn('getPatientUploadedFiles failed:', patientId, error);
      return [];
    }
  });

  const files: PatientUploadedFile[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < snapshots.length; index += 1) {
    const patientId = ids[index]!;
    const rows = snapshots[index] ?? [];
    for (const row of rows) {
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const rawUrl = String(row.url ?? '');
      const storageKey =
        String(row.storageKey ?? '') ||
        djangoMediaUrlToStorageKey(rawUrl) ||
        '';
      const category = String(row.category ?? '');
      const mimeType = String(row.mimeType ?? row.mime_type ?? '');
      const sizeBytes =
        typeof row.sizeBytes === 'number'
          ? row.sizeBytes
          : typeof row.size_bytes === 'number'
            ? row.size_bytes
            : null;
      const uploadedAtRaw = row.uploadedAt ?? row.createdAt ?? row.created_at;
      const name = formatMedicalFileTitle({
        title: String(row.title ?? ''),
        displayTitle: String(row.displayTitle ?? row.display_title ?? ''),
        category,
        mimeType,
        storageKey,
      });
      files.push({
        id,
        patientId,
        category,
        name,
        subtitle: formatMedicalFileSubtitle({ category, mimeType, sizeBytes }),
        url: rawUrl,
        storageKey,
        mimeType,
        sizeBytes,
        uploadedAt:
          typeof uploadedAtRaw === 'string' || uploadedAtRaw instanceof Date
            ? new Date(String(uploadedAtRaw))
            : null,
      });
    }
  }

  return files.sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
};
