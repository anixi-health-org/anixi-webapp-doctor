import {
  djangoDeleteMedicalFile,
  djangoListMedicalFiles,
  djangoMediaUrlToStorageKey,
  djangoUploadMedicalFile,
} from './djangoApiService';
import {
  formatMedicalFileSubtitle,
  formatMedicalFileTitle,
} from '../lib/medicalFileDisplay';
import { mapInBatches } from '../utils/asyncBatch';

export type PatientMedicalFileCategory = 'xrays' | 'blood_tests' | 'notes';

export const PATIENT_MEDICAL_FILE_CATEGORIES: {
  id: PatientMedicalFileCategory;
  label: string;
}[] = [
  { id: 'notes', label: 'Medical notes & reports' },
  { id: 'blood_tests', label: 'Blood tests & labs' },
  { id: 'xrays', label: 'X-rays & imaging' },
];

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
  uploadedByRole?: string;
  uploadedByName?: string;
  notes?: string;
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
      const uploadedByRole = String(row.uploadedByRole ?? '');
      const uploadedByName = String(row.uploadedByName ?? '');
      files.push({
        id,
        patientId,
        category,
        name,
        subtitle: formatMedicalFileSubtitle({
          category,
          mimeType,
          sizeBytes,
          uploadedByRole,
          uploadedByName,
        }),
        url: rawUrl,
        storageKey,
        mimeType,
        sizeBytes,
        uploadedByRole,
        uploadedByName,
        notes: String(row.notes ?? ''),
        uploadedAt:
          typeof uploadedAtRaw === 'string' || uploadedAtRaw instanceof Date
            ? new Date(String(uploadedAtRaw))
            : null,
      });
    }
  }

  return files.sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
};

export const getPatientMedicalFiles = async (
  patientId: string,
): Promise<PatientUploadedFile[]> => getPatientUploadedFiles([patientId]);

export const uploadPatientMedicalFile = async (input: {
  patientId: string;
  file: File;
  category: PatientMedicalFileCategory;
  title?: string;
  notes?: string;
}): Promise<PatientUploadedFile> => {
  const title = (input.title ?? input.file.name).trim() || 'Medical document';
  const uploaded = await djangoUploadMedicalFile(input.file, input.file.name, {
    patientId: input.patientId,
    title,
    category: input.category,
    notes: input.notes?.trim(),
  });
  const rows = await getPatientMedicalFiles(input.patientId);
  const match = rows.find((row) => row.id === uploaded.recordId);
  if (match) return match;
  return {
    id: uploaded.recordId ?? uploaded.storageKey,
    patientId: input.patientId,
    category: input.category,
    name: title,
    subtitle: formatMedicalFileSubtitle({
      category: input.category,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      uploadedByRole: 'clinician',
    }),
    url: uploaded.url,
    storageKey: uploaded.storageKey,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    uploadedAt: new Date(),
    uploadedByRole: 'clinician',
  };
};

export const removePatientMedicalFile = async (fileId: string): Promise<void> => {
  await djangoDeleteMedicalFile(fileId);
};
