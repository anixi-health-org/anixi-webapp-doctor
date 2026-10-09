import {
  djangoGetImportJobStatus,
  djangoImportJobResultsCsvUrl,
  djangoUnichartBatchApply,
  type DjangoBulkImportJob,
  type UnichartBatchApplyResult,
} from '../services/djangoApiService';
import { formatUnichartBatchApplySummary } from './unichartBatchApplySummary';
import { invalidateDoctorPatientPanelCache } from '../services/patientManagementService';

export async function startUnichartPdfImport(
  file: File,
  practiceId: string,
): Promise<{ async: boolean; jobId?: string; summary?: UnichartBatchApplyResult }> {
  const started = await djangoUnichartBatchApply(file, practiceId, { async: true });
  if (started.async && started.jobId) {
    return { async: true, jobId: started.jobId };
  }
  if (started.totalCharts !== undefined) {
    return { async: false, summary: started as UnichartBatchApplyResult };
  }
  throw new Error('Unexpected response from UniCharts import');
}

export async function pollUnichartImportJob(
  jobId: string,
  onProgress?: (job: DjangoBulkImportJob) => void,
): Promise<DjangoBulkImportJob> {
  const terminal = new Set(['completed', 'failed']);
  for (;;) {
    const job = await djangoGetImportJobStatus(jobId);
    onProgress?.(job);
    if (terminal.has(job.status)) {
      if (job.status === 'completed') invalidateDoctorPatientPanelCache();
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export function formatUnichartImportJobSummary(
  job: DjangoBulkImportJob,
  fileName: string,
): string {
  if (job.status === 'failed') {
    const err = job.errors[0]?.message ?? 'Import job failed';
    return `❌ UniCharts import failed for **${fileName}**: ${err}`;
  }
  const lines = [
    `✅ UniCharts import finished for **${fileName}**.`,
    `- **${job.totalRows || job.processedRows}** unique patient chart(s) in the PDF`,
    `- **${job.importedCount}** now on your clinic roster (matched, updated, or newly added)`,
    `- **${job.skippedCount}** could not be placed (invalid, ambiguous, or duplicate conflict)`,
  ];
  if (job.errorCount > 0) {
    lines.push(`- **${job.errorCount}** errors`);
    lines.push(`Download details: ${djangoImportJobResultsCsvUrl(job.jobId)}`);
  }
  if (job.importedCount === 0 && job.processedRows > 0) {
    lines.push('');
    lines.push(
      'No records matched. Charts need a patient name plus date of birth or chart/ID number aligned with your roster. Re-run after the latest parser update, or use **Patients → Import CSV or UniCharts PDF**.',
    );
  }
  return lines.join('\n');
}

export function formatUnichartImportOutcome(
  fileName: string,
  options: { async: boolean; job?: DjangoBulkImportJob; summary?: UnichartBatchApplyResult },
): string {
  if (options.summary) {
    return formatUnichartBatchApplySummary(options.summary, fileName);
  }
  if (options.job) {
    return formatUnichartImportJobSummary(options.job, fileName);
  }
  return `Processing **${fileName}**…`;
}
