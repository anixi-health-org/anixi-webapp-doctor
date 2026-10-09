import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { djangoOpenMediaDocument } from '../../services/djangoApiService';
import {
  getPatientMedicalFiles,
  PATIENT_MEDICAL_FILE_CATEGORIES,
  type PatientMedicalFileCategory,
  type PatientUploadedFile,
  removePatientMedicalFile,
  uploadPatientMedicalFile,
} from '../../services/patientDocumentService';

type Props = {
  patientId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  className?: string;
};

export const PatientMedicalFilesSection: React.FC<Props> = ({
  patientId,
  canUpload = true,
  canDelete = true,
  className = '',
}) => {
  const [files, setFiles] = useState<PatientUploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<PatientMedicalFileCategory>('notes');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await getPatientMedicalFiles(patientId);
      setFiles(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load medical files');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked || !patientId) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPatientMedicalFile({
        patientId,
        file: picked,
        category,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setTitle('');
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: PatientUploadedFile) => {
    if (!canDelete) return;
    const ok = window.confirm(`Remove "${file.name}" from this patient profile?`);
    if (!ok) return;
    try {
      await removePatientMedicalFile(file.id);
      setFiles((prev) => prev.filter((row) => row.id !== file.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove file');
    }
  };

  const openFile = (file: PatientUploadedFile) => {
    void djangoOpenMediaDocument(file.storageKey || file.url);
  };

  return (
    <section
      className={`rounded-2xl border border-[#e1e7ef] bg-white p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
            Medical files
          </p>
          <p className="mt-1 text-sm text-[#65758b]">
            Attach labs, imaging, and reports to this warrior profile. Files sync to the patient
            app and stay available to their care team.
          </p>
        </div>
        {canUpload ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            <DocumentTextIcon className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
        ) : null}
      </div>

      {canUpload ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-[#65758b]">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PatientMedicalFileCategory)}
              className="mt-1 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256]"
            >
              {PATIENT_MEDICAL_FILE_CATEGORIES.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[#65758b] sm:col-span-2">
            Display title (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. April 2026 lipid panel"
              className="mt-1 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256]"
            />
          </label>
          <label className="text-xs font-medium text-[#65758b] lg:col-span-4">
            Notes for the patient (optional)
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short context shown in the app"
              className="mt-1 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256]"
            />
          </label>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*,.doc,.docx"
        className="hidden"
        onChange={(event) => void handleUpload(event)}
      />

      {error ? (
        <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-[#65758b]">Loading attachments…</p>
        ) : files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#dfe6e1] bg-[#f8fafc] px-4 py-8 text-center text-sm text-[#65758b]">
            No medical files yet. Upload a PDF or image to attach it to this profile.
          </p>
        ) : (
          <ul className="divide-y divide-[#eef2f6] rounded-xl border border-[#e1e7ef]">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0E2340]">{file.name}</p>
                  <p className="mt-0.5 text-xs text-[#65758b]">{file.subtitle}</p>
                  {file.notes ? (
                    <p className="mt-1 text-xs text-[#344256]">{file.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openFile(file)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e1e7ef] px-3 text-xs font-semibold text-[#344256] hover:border-anixi-green/40"
                  >
                    <EyeIcon className="h-4 w-4" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => openFile(file)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e1e7ef] px-3 text-xs font-semibold text-[#344256] hover:border-anixi-green/40"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(file)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
