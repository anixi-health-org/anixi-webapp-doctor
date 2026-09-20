import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../components/page-layout';
import { ListRowsSkeleton, PageHeaderSkeleton } from '../components/ui/Skeleton';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { useAuth } from '../hooks/useAuth';
import { getPatientForDoctorView } from '../services/patientManagementService';
import {
  getPatientUploadedFiles,
  patientFileCategoryLabel,
  type PatientUploadedFile,
} from '../services/patientDocumentService';
import { djangoOpenMediaDocument, userFacingLoadError } from '../services/djangoApiService';
import { usePatientMedicalVaultAccess } from '../hooks/usePatientMedicalVaultAccess';
import type { Patient } from '../types';

export const PatientMedicalVaultPage: React.FC = () => {
  const { navigateBack } = useNavigateWithFallback();
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [files, setFiles] = useState<PatientUploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { canAccess, loading: accessLoading } = usePatientMedicalVaultAccess(patient);

  const load = useCallback(async () => {
    if (!patientId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const foundPatient = await getPatientForDoctorView(user.id, patientId);
      setPatient(foundPatient);

      const uploaded = await getPatientUploadedFiles([patientId]);
      setFiles(uploaded);
    } catch (err) {
      setError(userFacingLoadError(err, 'Could not load medical record vault'));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const patientName = patient?.displayName || patient?.email || 'Patient';

  const sortedFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0),
      ),
    [files],
  );

  if (!patientId) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Patient ID not found
        </div>
      </PageShell>
    );
  }

  if (loading || accessLoading) {
    return (
      <PageShell>
        <PageHeaderSkeleton />
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
          <ListRowsSkeleton rows={5} />
        </div>
      </PageShell>
    );
  }

  if (!canAccess) {
    return (
      <PageShell>
        <button
          type="button"
          onClick={() => navigateBack(`/patient-profile/${patientId}`)}
          className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Patient Profile
        </button>
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-6 text-sm text-[#65758b]">
          This patient is not connected to your practice yet. Their medical record vault
          becomes available once they activate their account or share records with you.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigateBack(`/patient-profile/${patientId}`)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Patient Profile
      </button>

      <PageHeader
        title="Medical record vault"
        description={`Documents ${patientName} uploaded from the Anixi patient app.`}
      />

      {error ? (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        {sortedFiles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <DocumentTextIcon className="mx-auto h-10 w-10 text-[#c5ced9]" />
            <p className="mt-3 text-sm font-medium text-[#344256]">No records in the vault yet</p>
            <p className="mt-1 text-sm text-[#65758b]">
              When {patientName} uploads medical documents in the app, they will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f6]">
            {sortedFiles.map((file) => (
              <li
                key={file.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4f1] text-[#427160]">
                    <DocumentArrowDownIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#344256]">{file.name}</p>
                    <p className="mt-0.5 text-sm text-[#65758b]">
                      {patientFileCategoryLabel(file.category)} · {file.subtitle}
                    </p>
                    {file.uploadedAt && !Number.isNaN(file.uploadedAt.getTime()) ? (
                      <p className="mt-0.5 text-xs text-[#94a3b8]">
                        {file.uploadedAt.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void djangoOpenMediaDocument(file.storageKey || file.url)}
                  className="inline-flex h-9 shrink-0 items-center rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
};
