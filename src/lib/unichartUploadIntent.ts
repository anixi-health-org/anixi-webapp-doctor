/** Clinic-wide UniCharts exports (e.g. Clinic_unicharts.pdf), not a single patient chart. */
export function isClinicUniChartsBulkExport(fileName: string): boolean {
  const name = fileName.trim().toLowerCase();
  if (/^clinic[_\-\s\d]/.test(name) && /unichart/.test(name)) {
    return true;
  }
  if (
    name.includes('clinic_export') ||
    name.includes('all_charts') ||
    name.includes('multichart') ||
    /unicharts/.test(name)
  ) {
    return true;
  }
  return false;
}

function isSinglePatientChartFileName(fileName: string): boolean {
  const name = fileName.trim().toLowerCase();
  if (isClinicUniChartsBulkExport(name)) {
    return false;
  }
  return name.includes('chart');
}

/** Detect bulk roster intent vs a single UniCharts patient chart PDF. */
export function isBulkRosterPdfIntent(fileName: string, userMessage: string): boolean {
  const name = fileName.trim().toLowerCase();
  const text = userMessage.trim().toLowerCase();
  const bulkPhrase =
    /all patients|every patient|update all|patient records|bulk|whole roster|entire roster|mass update|backfill|anything missing|missing fields/.test(
      text,
    );
  const documentPhrase =
    /here is the document|here'?s the document|attached|this pdf|this file|uploaded the|uni\s*charts/.test(
      text,
    );
  const clinicExportName = /^clinic[_\-\s\d]/.test(name) || name.includes('clinic_export');
  return (
    bulkPhrase ||
    documentPhrase ||
    isClinicUniChartsBulkExport(fileName) ||
    (clinicExportName && !isSinglePatientChartFileName(fileName))
  );
}

/** Route large / clinic-wide PDFs to batch-apply instead of single-chart preview. */
export function shouldUseUnichartBatchApply(
  fileName: string,
  userMessage: string,
  fileSizeBytes?: number,
): boolean {
  if (isBulkRosterPdfIntent(fileName, userMessage)) {
    return true;
  }
  const size = fileSizeBytes ?? 0;
  if (size > 5 * 1024 * 1024) {
    return true;
  }
  return false;
}

export function userExpectsAttachedDocument(userMessage: string): boolean {
  const text = userMessage.trim().toLowerCase();
  return /here is|here'?s the|attached|this document|the pdf|the file|uploaded/.test(text);
}

export function bulkRosterPdfGuidance(fileName: string): string {
  return (
    `**${fileName}** looks like a clinic export. Ayah will **OCR UniCharts PDFs** and backfill matched patients on your roster. ` +
    'For pure name lists without chart sections, use a **CSV** export from your PMS or **Patients → Import**.'
  );
}

function isLikelyNetworkFailure(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  );
}

export function formatUnichartBatchImportFailure(detail: string): string {
  const lower = detail.toLowerCase();
  if (isLikelyNetworkFailure(detail)) {
    return (
      `❌ UniCharts import could not reach the API (${detail}).\n\n` +
      'This step uses `/api/v1/patients/unichart/batch-apply/` (async for large PDFs). ' +
      'Confirm you are logged in, the API is up, and the file is under the **50MB** upload limit.'
    );
  }
  if (lower.includes('redis') || lower.includes('cache')) {
    return `❌ ${detail}\n\nBackground import needs Redis. Retry once the API workers are healthy.`;
  }
  return `❌ UniCharts import failed: ${detail}`;
}

export function formatUnichartPreviewFailure(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes('not a unicharts chart') || lower.includes('no readable text')) {
    return (
      `❌ ${detail}\n\n` +
      'This PDF is not a single UniCharts patient chart. For clinic-wide exports (e.g. **Clinic_unicharts.pdf**), say **backfill all patients** and attach the file again.'
    );
  }
  if (isLikelyNetworkFailure(detail)) {
    return (
      `❌ Could not upload chart for preview (${detail}).\n\n` +
      'If this is a **clinic-wide UniCharts PDF**, use **backfill all patients** so Ayah runs batch import instead of preview. ' +
      'Otherwise check login and `/api/v1/patients/unichart/preview/`.'
    );
  }
  if (lower.includes('redis') || lower.includes('cache')) {
    return `❌ ${detail}\n\nStart Redis (or \`docker compose up -d redis\`) and retry.`;
  }
  if (lower.includes('could not read')) {
    return `❌ ${detail}\n\nTry re-exporting the chart from UniCharts as a standard PDF.`;
  }
  return (
    `❌ Chart preview failed: ${detail}\n\n` +
    'This step calls `/api/v1/patients/unichart/preview/` on Django. ' +
    'Confirm the API is running, you are logged in, and the file is one UniCharts patient chart.'
  );
}
