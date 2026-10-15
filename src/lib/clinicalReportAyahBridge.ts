const STORAGE_PREFIX = 'anixi-clinical-report-draft';

function storageKey(appointmentId: string): string {
  return `${STORAGE_PREFIX}:${appointmentId}`;
}

/** Persist an approved Ayah H&P draft until PostConsult consumes it. */
export function persistClinicalReportDraftForAppointment(
  appointmentId: string,
  payload: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !appointmentId) return;
  try {
    window.sessionStorage.setItem(
      storageKey(appointmentId),
      JSON.stringify({ payload, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function consumeClinicalReportDraftForAppointment(
  appointmentId: string,
): Record<string, unknown> | null {
  if (typeof window === 'undefined' || !appointmentId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(appointmentId));
    if (!raw) return null;
    window.sessionStorage.removeItem(storageKey(appointmentId));
    const parsed = JSON.parse(raw) as { payload?: Record<string, unknown> };
    return parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : null;
  } catch {
    return null;
  }
}

export function buildClinicalReportAyahPrompt(params: {
  patientName: string;
  patientId: string;
  appointmentId: string;
  visitNote?: string;
  scribeSummary?: string;
  existingReportText?: string;
}): string {
  const visitBlocks = [
    params.visitNote?.trim() ? `Clinical note from this visit:\n${params.visitNote.trim()}` : null,
    params.scribeSummary?.trim() ? `Ayah scribe summary:\n${params.scribeSummary.trim()}` : null,
    params.existingReportText?.trim()
      ? `Working report sections:\n${params.existingReportText.trim()}`
      : null,
  ].filter(Boolean);

  return [
    `Draft a History & Physical consultation report for ${params.patientName}.`,
    `Patient ID: ${params.patientId}. Appointment ID: ${params.appointmentId}.`,
    '',
    'Required steps (do all of them):',
    '1. Call get-patient-overview and get-doctor-patient-medications for this patient.',
    '2. Call draft-clinical-report with every H&P section you can support from chart + visit context.',
    '3. Leave a section empty if it is not documented — never invent examination findings, vitals, or history.',
    '4. Tell the doctor the draft appears under "For your review" and they must tap Apply to report to fill the form.',
    '',
    visitBlocks.length ? 'Visit context (use for HPI / assessment where documented):' : 'No visit note yet — use chart data only.',
    ...visitBlocks,
  ].join('\n');
}
