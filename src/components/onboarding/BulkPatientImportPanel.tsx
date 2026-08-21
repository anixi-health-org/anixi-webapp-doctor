import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload, Users, X } from 'lucide-react';
import {
  downloadPatientImportTemplate,
  importPracticePatientsBulk,
  parsePatientBulkCsv,
  PATIENT_IMPORT_CSV_HEADERS,
  type BulkPatientRow,
} from '../../services/bulkPatientImportService';

type BulkPatientImportPanelProps = {
  doctorId: string;
  practiceId: string;
  practiceName?: string;
  onComplete?: () => void;
};

export const BulkPatientImportPanel: React.FC<BulkPatientImportPanelProps> = ({
  doctorId,
  practiceId,
  practiceName,
  onComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkPatientRow[]>([]);
  const [parseIssues, setParseIssues] = useState<{ line: number; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; failed: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    setSummary(null);
    setErrors([]);
    const text = await file.text();
    const parsed = parsePatientBulkCsv(text);
    setFileName(file.name);
    setRows(parsed.rows);
    setParseIssues(parsed.issues);
  };

  const clearFile = () => {
    setFileName(null);
    setRows([]);
    setParseIssues([]);
    setSummary(null);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setErrors(['Upload a filled CSV with at least one patient (name and email required).']);
      return;
    }

    setSaving(true);
    setErrors([]);
    setSummary(null);
    try {
      const results = await importPracticePatientsBulk({
        doctorId,
        practiceId,
        practiceName,
        rows,
        sendAppInvites: true,
      });
      const imported = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);
      setSummary({ imported, failed: failed.length });
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

  return (
    <div className="rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-anixi-green/10 text-anixi-green">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#344256]">Import your patients</p>
            <p className="text-xs text-[#65758b]">
              Download the template, fill in your roster, then upload. Each patient receives an
              app invite email with download links (they create their own password when they
              sign up).
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
                  Columns: {PATIENT_IMPORT_CSV_HEADERS.join(', ')}. Email is required for login
                  invites.
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {rows.map((row) => (
                    <tr key={`${row.email}-${row.displayName}`} className="text-[#344256]">
                      <td className="px-4 py-2.5">{row.displayName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.email}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">{row.phoneNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        {summary && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {summary.imported} patient{summary.imported !== 1 ? 's' : ''} imported with login
            emails sent
            {summary.failed > 0 ? `, ${summary.failed} failed` : ''}.
          </p>
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
              Importing & sending invites…
            </>
          ) : (
            `Import ${rows.length > 0 ? rows.length : ''} patient${rows.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
};
