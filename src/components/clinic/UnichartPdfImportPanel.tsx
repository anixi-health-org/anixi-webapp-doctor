import React, { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import {
  formatUnichartImportJobSummary,
  pollUnichartImportJob,
  startUnichartPdfImport,
} from '../../lib/unichartPdfImportJob';
import { formatUnichartBatchApplySummary } from '../../lib/unichartBatchApplySummary';
import type { DjangoBulkImportJob } from '../../services/djangoApiService';

const MAX_MB = 50;

type UnichartPdfImportPanelProps = {
  practiceId: string;
  onComplete?: () => void;
};

export const UnichartPdfImportPanel: React.FC<UnichartPdfImportPanelProps> = ({
  practiceId,
  onComplete,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<DjangoBulkImportJob | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setFile(null);
    setJob(null);
    setSummaryText(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onPick = (picked: File) => {
    setError(null);
    setSummaryText(null);
    setJob(null);
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`File is over ${MAX_MB}MB. Split the export or contact Anixi support.`);
      return;
    }
    setFile(picked);
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSummaryText(null);
    try {
      const started = await startUnichartPdfImport(file, practiceId);
      if (started.async && started.jobId) {
        const finished = await pollUnichartImportJob(started.jobId, (progress) => setJob(progress));
        setSummaryText(formatUnichartImportJobSummary(finished, file.name));
        if (finished.importedCount > 0) onComplete?.();
      } else if (started.summary) {
        setSummaryText(formatUnichartBatchApplySummary(started.summary, file.name));
        if ((started.summary.applied ?? 0) + (started.summary.created ?? 0) > 0) {
          onComplete?.();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'UniCharts import failed');
    } finally {
      setBusy(false);
    }
  };

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : null;

  return (
    <div className="rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f]">
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#344256]">UniCharts PDF import</p>
            <p className="text-xs text-[#65758b]">
              Upload a clinic export from UniCharts (up to {MAX_MB}MB). Anixi OCRs the PDF in the
              background, matches each chart to your roster, creates missing patients, and fills
              empty clinical fields.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onPick(picked);
          }}
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafcfb] px-6 py-10 text-center transition hover:border-[#1e3a5f] hover:bg-[#1e3a5f]/[0.03]"
          >
            <Upload className="h-8 w-8 text-[#94a3b8]" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-[#344256]">Upload UniCharts PDF</span>
            <span className="text-xs text-[#94a3b8]">Large files (e.g. 20MB) run as a background job</span>
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#344256]">{file.name}</p>
              <p className="text-xs text-[#65758b]">{sizeMb} MB · PDF</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#65758b] hover:bg-white"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        )}

        {job && job.status !== 'completed' && job.status !== 'failed' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
            <p className="text-sm font-medium text-blue-900">
              {job.totalRows > 0
                ? `Processing chart ${job.processedRows} of ${job.totalRows}…`
                : 'Extracting text from PDF…'}
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-100">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${
                    job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 8
                  }%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-700">
              {job.importedCount} updated or created so far · keep this tab open
            </p>
          </div>
        )}

        {summaryText ? (
          <div className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {summaryText}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#eef2f6] bg-[#fafcfb] px-5 py-4 sm:px-6">
        <button
          type="button"
          disabled={busy || !file}
          onClick={() => void runImport()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1e3a5f] px-8 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            'Run UniCharts import'
          )}
        </button>
      </div>
    </div>
  );
};
