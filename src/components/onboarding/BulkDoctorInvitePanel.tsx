import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { ROLE_LABELS } from '../../lib/practiceRoles';
import {
  createPracticeInvitesBulk,
  DOCTOR_INVITE_CSV_HEADERS,
  DOCTOR_INVITE_ROLE_HINT,
  downloadDoctorInviteTemplate,
  parseDoctorBulkCsv,
  type BulkDoctorRow,
} from '../../services/bulkInviteService';

type BulkDoctorInvitePanelProps = {
  practiceId: string;
  practiceName: string;
  invitedBy: string;
  invitedByName?: string;
  onComplete?: () => void;
};

export const BulkDoctorInvitePanel: React.FC<BulkDoctorInvitePanelProps> = ({
  practiceId,
  practiceName,
  invitedBy,
  invitedByName,
  onComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkDoctorRow[]>([]);
  const [parseIssues, setParseIssues] = useState<{ line: number; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ sent: number; failed: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    setSummary(null);
    setErrors([]);
    const text = await file.text();
    const parsed = parseDoctorBulkCsv(text);
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

  const handleSend = async () => {
    if (rows.length === 0) {
      setErrors(['Upload a filled CSV with at least one valid staff member.']);
      return;
    }

    setSaving(true);
    setErrors([]);
    setSummary(null);
    try {
      const results = await createPracticeInvitesBulk(
        { practiceId, practiceName, invitedBy, invitedByName },
        rows
      );
      const sent = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);
      setSummary({ sent, failed: failed.length });
      if (failed.length) {
        setErrors(failed.map((f) => `${f.email}: ${f.error}`));
      }
      if (sent > 0) onComplete?.();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not send invites']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-anixi-green/10 text-anixi-green">
            <Upload className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#344256]">Invite your doctors & team</p>
            <p className="text-xs text-[#65758b]">
              Download the template, fill in your staff, then upload the CSV. Each person receives
              an email to create their login.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* Step 1: Download template */}
        <div className="rounded-xl border border-[#eef2f6] bg-[#fafcfb] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-anixi-green ring-1 ring-[#e1e7ef]">
                <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#344256]">1. Download CSV template</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#65758b]">
                  Columns: {DOCTOR_INVITE_CSV_HEADERS.join(', ')}. Role must be one of:{' '}
                  {DOCTOR_INVITE_ROLE_HINT}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadDoctorInviteTemplate}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-anixi-green bg-white px-5 py-2.5 text-sm font-semibold text-anixi-green transition hover:bg-anixi-green/5"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download template
            </button>
          </div>
        </div>

        {/* Step 2: Upload */}
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
                    {rows.length} staff member{rows.length !== 1 ? 's' : ''} ready to invite
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

        {/* Preview table */}
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#eef2f6]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">HPCSA no.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {rows.map((row) => (
                    <tr key={row.email} className="text-[#344256]">
                      <td className="px-4 py-2.5">{row.displayName || '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.email}</td>
                      <td className="px-4 py-2.5">{ROLE_LABELS[row.role]}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">{row.phone || '-'}</td>
                      <td className="px-4 py-2.5 text-[#65758b]">{row.hpcsaNumber || '-'}</td>
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
              {parseIssues.length > 6 && <li>…and {parseIssues.length - 6} more</li>}
            </ul>
          </div>
        )}

        {summary && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {summary.sent} activation email{summary.sent !== 1 ? 's' : ''} sent — each doctor
            receives a link to create their login and join {practiceName}.
            {summary.failed > 0 ? ` ${summary.failed} could not be sent.` : ''}
          </p>
        )}
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 5 && <li>…and {errors.length - 5} more</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-[#eef2f6] bg-[#fafcfb] px-5 py-4 sm:px-6">
        <button
          type="button"
          disabled={saving || rows.length === 0}
          onClick={() => void handleSend()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-anixi-green py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending invites…
            </>
          ) : (
            `Send ${rows.length > 0 ? rows.length : ''} invitation${rows.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
};
