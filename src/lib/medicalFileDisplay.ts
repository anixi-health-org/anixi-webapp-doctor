const CATEGORY_LABELS: Record<string, string> = {
  xrays: 'X-ray',
  blood_tests: 'Blood test',
  notes: 'Patient note',
};

const MACHINE_FILENAME =
  /^(\d{10,}_)?[0-9A-Fa-f-]{8,}\.[A-Za-z0-9]+$|^IMG_\d+|^\d{10,}_/i;

export function isMachineMedicalFilename(name: string): boolean {
  const base = name.trim().split('/').pop() ?? '';
  if (!base) return true;
  return MACHINE_FILENAME.test(base);
}

export function medicalFileExtension(params: {
  title?: string;
  mimeType?: string;
  storageKey?: string;
}): string {
  for (const candidate of [params.title, params.storageKey]) {
    if (candidate?.includes('.')) {
      return candidate.split('.').pop()?.toLowerCase() ?? '';
    }
  }
  const mime = params.mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return mime.slice('image/'.length);
  return '';
}

export function formatMedicalFileTitle(params: {
  title?: string;
  displayTitle?: string;
  category?: string;
  mimeType?: string;
  storageKey?: string;
}): string {
  const provided = String(params.displayTitle ?? '').trim();
  if (provided) return provided;

  const rawTitle = String(params.title ?? '').trim();
  const label = CATEGORY_LABELS[params.category ?? ''] ?? 'Medical document';
  const ext = medicalFileExtension(params);
  if (rawTitle && !isMachineMedicalFilename(rawTitle)) return rawTitle;
  return ext ? `${label} (${ext.toUpperCase()})` : label;
}

export function formatMedicalFileSubtitle(params: {
  category?: string;
  mimeType?: string;
  sizeBytes?: number | null;
}): string {
  const label = CATEGORY_LABELS[params.category ?? ''] ?? 'Document';
  const parts = [`${label} · uploaded by patient`];
  if (params.sizeBytes && params.sizeBytes > 0) {
    const kb = params.sizeBytes / 1024;
    parts.push(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`);
  } else if (params.mimeType) {
    parts.push(params.mimeType.split(';', 1)[0]);
  }
  return parts.join(' · ');
}
