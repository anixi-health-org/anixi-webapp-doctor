import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload, Users, X, Copy, Check } from 'lucide-react';
import {
  downloadPatientImportTemplate,
  importPracticePatientsBulk,
  parsePatientBulkCsv,
  PATIENT_IMPORT_CSV_HEADERS,
  type BulkPatientRow,
  type BulkPatientResult,
} from '../../services/bulkPatientImportService';
import {
  djangoImportRosterCsv,
  djangoGetImportJobStatus,
  djangoImportJobResultsCsvUrl,
  type DjangoBulkImportJob,
} from '../../services/djangoApiService';

const BATCH_THRESHOLD = 500;

type BulkPatientImportPanelProps = {
  doctorId: string;
  practiceId: string;
  practiceName?: string;
  clinicCode?: string;
  onComplete?: () => void;
};

export const BulkPatientImportPanel: React.FC<BulkPatientImportPanelProps> = ({
  doctorId,
  practiceId,
  practiceName,
  clinicCode,
  onComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [rows, setRows] = useState<BulkPatientRow[]>([]);
  const [parseIssues, setParseIssues] = useState<{ line: number; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; failed: number; needsActivation: number } | null>(null);
  const [, setResults] = useState<BulkPatientResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [batchJob, setBatchJob] = useState<DjangoBulkImportJob | null>(null);
  const [batchResultsUrl, setBatchResultsUrl] = useState<string | null>(null);

  const useBatchMode = rows.length > BATCH_THRESHOLD;

  const handleFile = async (file: File) => {
    setSummary(null);
    setErrors([]);
    setResults([]);
    setBatchJob(null);
    setBatchResultsUrl(null);
    const text = await file.text();
    const parsed = parsePatientBulkCsv(text);
    setFileName(file.name);
    setRawFile(file);
    setRows(parsed.rows);
    setParseIssues(parsed.issues);
  };

  const clearFile = () => {
    setFileName(null);
    setRawFile(null);
    setRows([]);
    setParseIssues([]);
    setSummary(null);
    setResults([]);
    setErrors([]);
    setBatchJob(null);
    setBatchResultsUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pollBatchJob = async (jobId: string) => {
    const poll = async () => {
      try {
        const status = await djangoGetImportJobStatus(jobId);
        setBatchJob(status);
        if (status.status === 'completed' || status.status === 'failed') {
          setSaving(false);
          setBatchResultsUrl(djangoImportJobResultsCsvUrl(jobId));
          setSummary({
            imported: status.importedCount,
            failed: status.errorCount,
            needsActivation: status.importedCount,
          });
          if (status.importedCount > 0) onComplete?.();
          return;
        }
      } catch {
        /* keep polling */
      }
      setTimeout(poll, 1000);
    };
    void poll();
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setErrors(['Upload a filled CSV with at least one patient (name + email, phone, or MRN/chart ID).']);
      return;
    }

    setSaving(true);
    setErrors([]);
    setSummary(null);
    setResults([]);
    setBatchJob(null);
    setBatchResultsUrl(null);

    if (useBatchMode && rawFile) {
      try {
        const job = await djangoImportRosterCsv(rawFile, practiceId);
        setBatchJob({
          jobId: job.jobId,
          status: (job.status as DjangoBulkImportJob['status']) || 'processing',
          totalRows: job.totalRows,
          processedRows: 0,
          importedCount: 0,
          skippedCount: 0,
          errorCount: 0,
          errors: [],
          startedAt: new Date().toISOString(),
          completedAt: null,
          createdAt: new Date().toISOString(),
        });
        void pollBatchJob(job.jobId);
      } catch (err) {
        setSaving(false);
        setErrors([err instanceof Error ? err.message : 'Batch upload failed']);
      }
      return;
    }

    try {
      const importResults = await importPracticePatientsBulk({
        doctorId,
        practiceId,
        practiceName,
        rows,
        sendAppInvites: true,
      });
      setResults(importResults);
      const imported = importResults.filter((r) => r.success).length;
      const failed = importResults.filter((r) => !r.success);
      const needsActivation = importResults.filter((r) => r.success && r.activationCode).length;
      setSummary({ imported, failed: failed.length, needsActivation });
      if (failed.length) {
        setErrors(failed.map((f) => `${f.displayName}: ${f.error}`));
      }
      if (imported > 0) onComplete?.();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Import failed']);
    } finally {
      setSaving(false);
    }
  };

  const copySignupLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch { /* clipboard not available */ }
  };

  const emailCount = rows.filter((r) => r.email?.trim()).length;
  const withoutEmailCount = rows.filter((r) => !r.email?.trim()).length;
  const phoneOnlyCount = rows.filter((r) => !r.email?.trim() && r.phoneNumber?.trim()).length;
  const identifierOnlyCount = rows.filter(
    (r) => !r.email?.trim() && !r.phoneNumber?.trim() && (r.mrn?.trim() || r.chartId?.trim()),
  ).length;

  return (
    <div className="rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-anixi-green/10 text-anixi-green">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#344256]">Import your patients</p>
            <p className="text-xs text-[#65758b]">
              Download the template, fill in your roster, then upload. After import,
              share your clinic code with patients so they can activate their accounts
              in the Anixi app.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-xl border border-[#eef2f6] bg-[#fafcfb] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-anixi-green ring-1 ring-[#e1e7ef]">
                <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#344256]">1. Download CSV template</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#65758b]">
                  Columns: {PATIENT_IMPORT_CSV_HEADERS.join(', ')}. Email and phone are optional
                  if MRN or chart ID is present. All patients activate with the clinic code.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadPatientImportTemplate}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-anixi-green bg-white px-5 py-2.5 text-sm font-semibold text-anixi-green transition hover:bg-anixi-green/5"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download template
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#344256]">2. Upload filled CSV</p>
          <p className="mb-3 text-xs text-[#65758b]">
            Supports Anixi template <em>and</em> practice management exports (columns like Patient Last Name,
            Patient First Name, Chart ID, Patient MRN are auto-detected).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {!fileName ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafcfb] px-6 py-10 text-center transition hover:border-anixi-green hover:bg-anixi-green/[0.03]"
            >
              <Upload className="h-8 w-8 text-[#94a3b8]" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-[#344256]">Click to upload CSV</span>
              <span className="text-xs text-[#94a3b8]">or drag and drop your filled template here</span>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-anixi-green" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#344256]">{fileName}</p>
                  <p className="text-xs text-[#65758b]">
                    {rows.length} patient{rows.length !== 1 ? 's' : ''} ready to import
                    {emailCount > 0 && ` · ${emailCount} with email`}
                    {phoneOnlyCount > 0 && ` · ${phoneOnlyCount} phone-only`}
                    {identifierOnlyCount > 0 && ` · ${identifierOnlyCount} MRN/chart only`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#65758b] hover:bg-white hover:text-[#344256]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#eef2f6]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">DOB</th>
                    <th className="px-4 py-2.5">Gender</th>
                    <th className="px-4 py-2.5">Chart / MRN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={`${row.email || row.phoneNumber}-${i}`} className="text-[#344256]">
                      <td className="px-4 py-2.5">{row.displayName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.email || <span className="text-amber-600">-</span>}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">{row.phoneNumber || '-'}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">{row.dateOfBirth || '-'}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">{row.gender || '-'}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">
                        {[row.chartId, row.mrn].filter(Boolean).join(' / ') || '-'}
                      </td>
                    </tr>
                  ))}
                  {rows.length > 50 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-2.5 text-center text-xs text-[#65758b]">
                        …and {rows.length - 50} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(withoutEmailCount > 0) && rows.length > 0 && !summary && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">
              {withoutEmailCount.toLocaleString()} patient
              {withoutEmailCount !== 1 ? 's' : ''} without email
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              After import, share your clinic code with patients. In the Anixi app
              they choose &quot;Activate clinic account&quot;, enter the clinic code + their personal
              details, and the system matches them to their record.
            </p>
          </div>
        )}

        {parseIssues.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Some rows were skipped:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {parseIssues.slice(0, 6).map((issue) => (
                <li key={`${issue.line}-${issue.message}`}>
                  Line {issue.line}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {batchJob && batchJob.status !== 'completed' && batchJob.status !== 'failed' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-900">
                {`Processing ${batchJob.totalRows.toLocaleString()} patients…`}
              </p>
              <span className="text-xs font-semibold text-blue-600">
                {batchJob.totalRows > 0
                  ? Math.round((batchJob.processedRows / batchJob.totalRows) * 100)
                  : 0}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-blue-100">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                style={{
                  width: `${batchJob.totalRows > 0 ? (batchJob.processedRows / batchJob.totalRows) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-700">
              {batchJob.processedRows.toLocaleString()} / {batchJob.totalRows.toLocaleString()} rows
              · {batchJob.importedCount.toLocaleString()} imported so far
            </p>
          </div>
        )}

        {useBatchMode && rows.length > 0 && !batchJob && !summary && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <p className="font-medium">Large file detected ({rows.length.toLocaleString()} patients)</p>
            <p className="mt-1 text-xs leading-relaxed">
              This will be processed in the background in batches of 100. You&apos;ll see a progress bar, and once
              complete you can download a CSV of import results.
            </p>
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {summary.imported} patient{summary.imported !== 1 ? 's' : ''} imported successfully
              {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}.
            </p>

            {clinicCode && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
                <p className="text-sm font-medium text-blue-900">
                  Share this clinic code with your patients
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  All patients use this single code to activate their accounts in the Anixi app.
                  They enter the code + their personal details (email, phone, or ID number).
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="rounded-lg bg-white px-5 py-3 font-mono text-2xl font-bold tracking-widest text-blue-800 ring-1 ring-blue-200">
                    {clinicCode}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    onClick={() => void copySignupLink(clinicCode)}
                  >
                    {copiedLink === clinicCode ? (
                      <><Check className="h-4 w-4" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copy code</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {batchResultsUrl && (
              <a
                href={batchResultsUrl}
                download
                className="inline-flex items-center gap-2 rounded-full border-2 border-anixi-green bg-white px-5 py-2.5 text-sm font-semibold text-anixi-green transition hover:bg-anixi-green/5"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download import results CSV
              </a>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-[#eef2f6] bg-[#fafcfb] px-5 py-4 sm:px-6">
        <button
          type="button"
          disabled={saving || rows.length === 0}
          onClick={() => void handleImport()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-anixi-green py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
              {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {useBatchMode
                ? batchJob
                  ? 'Importing patients…'
                  : 'Starting import…'
                : 'Importing & sending invites…'}
            </>
          ) : (
            `Import ${rows.length > 0 ? rows.length.toLocaleString() : ''} patient${rows.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
};
