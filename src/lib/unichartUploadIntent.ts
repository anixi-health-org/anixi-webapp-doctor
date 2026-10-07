/** Detect bulk roster intent vs a single UniCharts patient chart PDF. */
export function isBulkRosterPdfIntent(fileName: string, userMessage: string): boolean {
  const name = fileName.trim().toLowerCase();
  const text = userMessage.trim().toLowerCase();
  const bulkPhrase =
    /all patients|every patient|update all|bulk|whole roster|entire roster|mass update|backfill|anything missing|missing fields/.test(
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
    (clinicExportName && !name.includes('chart'))
  );
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

export function formatUnichartPreviewFailure(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes('not a unicharts chart') || lower.includes('no readable text')) {
    return (
      `❌ ${detail}\n\n` +
      'This PDF is not a single UniCharts patient chart. For bulk roster updates, use a **patient CSV** instead of a clinic-wide PDF.'
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
