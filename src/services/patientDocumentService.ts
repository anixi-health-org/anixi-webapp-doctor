import { djangoListMedicalFiles, djangoResolveMediaUrl } from './djangoApiService';
import { mapInBatches } from '../utils/asyncBatch';

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
      files.push({
        id,
        patientId,
        category: String(row.category ?? ''),
        name: String(row.title ?? 'Document'),
        url: (await djangoResolveMediaUrl(rawUrl)) ?? rawUrl,
        mimeType: String(row.mimeType ?? ''),
        uploadedAt: null,
      });
    }
  }

  return files.sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
};
