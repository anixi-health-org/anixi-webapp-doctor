import React, { useRef, useState } from 'react';
import { Download, DoorOpen, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import {
  downloadRoomImportTemplate,
  importPracticeRoomsBulk,
  parseRoomBulkCsv,
  ROOM_IMPORT_CSV_HEADERS,
  type BulkRoomRow,
} from '../../services/bulkRoomImportService';
import type { Practice } from '../../types';

type BulkRoomImportPanelProps = {
  practice: Practice;
  onComplete?: () => void;
};

export const BulkRoomImportPanel: React.FC<BulkRoomImportPanelProps> = ({
  practice,
  onComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRoomRow[]>([]);
  const [parseIssues, setParseIssues] = useState<{ line: number; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const locations = practice.locations ?? [];

  const handleFile = async (file: File) => {
    setSummary(null);
    setErrors([]);
    const text = await file.text();
    const parsed = parseRoomBulkCsv(text, locations);
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
      setErrors(['Upload a filled CSV with at least one room name.']);
      return;
    }

    setSaving(true);
    setErrors([]);
    setSummary(null);
    try {
      const results = await importPracticeRoomsBulk({ practice, rows });
      const imported = results.filter((r) => r.success && !r.skippedDuplicate).length;
      const skipped = results.filter((r) => r.skippedDuplicate).length;
      const failed = results.filter((r) => !r.success);
      setSummary({ imported, skipped, failed: failed.length });
      if (failed.length) {
        setErrors(failed.map((f) => `${f.name}: ${f.error}`));
      }
      if (imported > 0 || skipped > 0) {
        onComplete?.();
        if (imported > 0) clearFile();
      }
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a4d4d]/10 text-[#1a4d4d]">
            <DoorOpen className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#344256]">Bulk import rooms</p>
            <p className="text-xs text-[#65758b]">
              Download the template, add your consult and procedure rooms, then upload to configure
              them all at once for front-desk scheduling.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-xl border border-[#eef2f6] bg-[#fafcfb] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#344256]">1. Download CSV template</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#65758b]">
                Columns: {ROOM_IMPORT_CSV_HEADERS.join(', ')}. Type can be consult, procedure,
                virtual, or other. Location is optional — use a clinic location name if set up.
              </p>
              {locations.length > 0 ? (
                <p className="mt-1 text-xs text-[#65758b]">
                  Known locations: {locations.map((loc) => loc.name).join(', ')}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">
                  No clinic locations yet — leave location blank or add locations under Clinic settings.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={downloadRoomImportTemplate}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#1a4d4d] bg-white px-5 py-2.5 text-sm font-semibold text-[#1a4d4d] transition hover:bg-[#1a4d4d]/5"
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
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafcfb] px-6 py-8 text-center transition hover:border-[#1a4d4d] hover:bg-[#1a4d4d]/[0.03]"
            >
              <Upload className="h-7 w-7 text-[#94a3b8]" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-[#344256]">Click to upload CSV</span>
              <span className="text-xs text-[#94a3b8]">or drag and drop your room list here</span>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-[#1a4d4d]" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#344256]">{fileName}</p>
                  <p className="text-xs text-[#65758b]">
                    {rows.length} room{rows.length !== 1 ? 's' : ''} ready to import
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
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                <tr>
                  <th className="px-4 py-2.5">Room</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f6]">
                {rows.slice(0, 20).map((row) => (
                  <tr key={`${row.name}-${row.locationId ?? 'any'}`} className="text-[#344256]">
                    <td className="px-4 py-2.5">{row.name}</td>
                    <td className="px-4 py-2.5 capitalize">{row.type}</td>
                    <td className="px-4 py-2.5 text-[#65758b]">
                      {row.locationName || row.locationId || 'Any location'}
                    </td>
                    <td className="px-4 py-2.5 text-[#65758b]">{row.capacity ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {summary.imported} room{summary.imported !== 1 ? 's' : ''} added
            {summary.skipped > 0 ? ` · ${summary.skipped} already existed` : ''}
            {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}.
          </p>
        )}

        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.map((e) => (
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
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a4d4d] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Importing rooms…
            </>
          ) : (
            `Import ${rows.length > 0 ? rows.length : ''} room${rows.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
};
