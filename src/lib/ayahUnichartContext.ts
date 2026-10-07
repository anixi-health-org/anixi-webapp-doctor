import type { AskAnixiContext } from '../services/askAnixiService';
import type { UnichartPreview } from '../services/djangoApiService';

/** Appended to clinic-admin agent turns when a UniCharts preview is active. */
export function unichartAgentContextSuffix(preview: UnichartPreview | null | undefined): string {
  if (!preview?.previewId) return '';
  const patient = preview.patient?.displayName ?? 'no matched patient';
  const fields = preview.fills.length ? preview.fills.join(', ') : 'none';
  return ` Context: UniCharts previewId ${preview.previewId}, status ${preview.status}, patient ${patient}, empty fields to fill: ${fields}. The portal already parsed the PDF — do not ask for documentId; use this previewId with chart tools if needed, or tell the user to tap Confirm chart import in the UI.`;
}

export function unichartContextFields(
  preview: UnichartPreview | null | undefined,
): Record<string, string | undefined> {
  if (!preview?.previewId) return {};
  return {
    unichartPreviewId: preview.previewId,
    unichartPreviewStatus: preview.status,
    unichartPreviewPatientId: preview.patient?.id,
    ...(preview.patient?.displayName
      ? { patientName: preview.patient.displayName, patientId: preview.patient.id }
      : {}),
  };
}

export type ClinicImportSessionFields = Pick<
  AskAnixiContext,
  'importJobId' | 'unichartImportSummary' | 'unichartBatchApplied' | 'unichartBatchTotal'
>;

/** Merge persisted clinic import session into every companion request. */
export function mergeClinicImportSession(
  base: AskAnixiContext,
  session: ClinicImportSessionFields,
): AskAnixiContext {
  return {
    ...base,
    ...(session.importJobId ? { importJobId: session.importJobId } : {}),
    ...(session.unichartImportSummary
      ? { unichartImportSummary: session.unichartImportSummary }
      : {}),
    ...(session.unichartBatchApplied != null
      ? { unichartBatchApplied: session.unichartBatchApplied }
      : {}),
    ...(session.unichartBatchTotal != null
      ? { unichartBatchTotal: session.unichartBatchTotal }
      : {}),
  };
}

export function clinicImportSessionFromRefs(refs: {
  jobId: string | null;
  summary: string | null;
  applied: number | null;
  total: number | null;
}): ClinicImportSessionFields {
  return {
    ...(refs.jobId ? { importJobId: refs.jobId } : {}),
    ...(refs.summary ? { unichartImportSummary: refs.summary } : {}),
    ...(refs.applied != null ? { unichartBatchApplied: refs.applied } : {}),
    ...(refs.total != null ? { unichartBatchTotal: refs.total } : {}),
  };
}

/** Tell the clinic-admin agent a UniCharts bulk import already ran in this session. */
export function clinicImportAgentSuffix(ctx: AskAnixiContext): string {
  const summary = ctx.unichartImportSummary?.trim();
  if (!summary) return '';
  const job = ctx.importJobId ? ` importJobId=${ctx.importJobId}.` : '';
  const counts =
    ctx.unichartBatchApplied != null
      ? ` ${ctx.unichartBatchApplied} records updated or created.`
      : '';
  return (
    ` Context: The portal already completed UniCharts OCR/import for this clinic session.${job}${counts} ` +
    `Results summary: ${summary.replace(/\s+/g, ' ').slice(0, 1200)} ` +
    'Do not ask the admin to upload the PDF or CSV again. Do not call verify-unicharts-roster or re-run-unichart-import-job unless they explicitly ask to compare the PDF to the roster or to run the import again. Answer from this summary first.'
  );
}

/** Agent turn after portal finished OCR — avoids re-asking for the PDF. */
export function clinicImportFollowUpPrompt(fileName: string, summary: string): string {
  const flat = summary.replace(/\s+/g, ' ').trim().slice(0, 800);
  return (
    `The portal already finished UniCharts OCR/import for ${fileName}. Results: ${flat}. ` +
    'Summarize outcomes and what skipped rows mean. Do not ask the admin to upload the PDF or CSV again.'
  );
}

export function wantsUnichartApply(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /backfill/.test(t) ||
    /fill empty/.test(t) ||
    /apply chart/.test(t) ||
    /confirm chart/.test(t) ||
    /^confirm$/.test(t) ||
    /apply the chart/.test(t)
  );
}
