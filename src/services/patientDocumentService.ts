import { djangoListMedicalFiles } from './djangoApiService';

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

  const snapshots = await Promise.all(ids.map((patientId) => djangoListMedicalFiles(patientId)));

  const files: PatientUploadedFile[] = [];
  const seen = new Set<string>();

  snapshots.forEach((rows, index) => {
    const patientId = ids[index]!;
    rows.forEach((row) => {
      const id = String(row.id);
      if (seen.has(id)) return;
      seen.add(id);
      files.push({
        id,
        patientId,
        category: String(row.category ?? ''),
        name: String(row.title ?? 'Document'),
        url: String(row.url ?? ''),
        mimeType: String(row.mimeType ?? ''),
        uploadedAt: null,
      });
    });
  });

  return files.sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
};
