import {
  djangoGetImportJobStatus,
  djangoImportJobResultsCsvUrl,
  djangoImportRosterCsv,
  djangoImportRosterPdf,
  type DjangoBulkImportJob,
} from '../services/djangoApiService';
import { invalidateDoctorPatientPanelCache } from '../services/patientManagementService';

export async function startBulkRosterImport(
  file: File,
  practiceId: string,
): Promise<{ jobId: string; totalRows: number }> {
  const lower = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
  const started = isPdf
    ? await djangoImportRosterPdf(file, practiceId)
    : await djangoImportRosterCsv(file, practiceId);
  return { jobId: started.jobId, totalRows: started.totalRows };
}

export async function pollBulkImportJob(
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function formatBulkImportJobSummary(job: DjangoBulkImportJob, fileName: string): string {
  if (job.status === 'failed') {
    const err = job.errors[0]?.message ?? 'Import job failed';
    return `❌ Roster import failed for **${fileName}**: ${err}`;
  }
  const lines = [
    `✅ Roster import finished for **${fileName}**.`,
    `- **${job.importedCount}** imported`,
    `- **${job.skippedCount}** skipped`,
    `- **${job.errorCount}** errors`,
    `- **${job.processedRows}** / **${job.totalRows}** processed`,
  ];
  if (job.errorCount > 0) {
    lines.push(`Download details: ${djangoImportJobResultsCsvUrl(job.jobId)}`);
  }
  return lines.join('\n');
}
