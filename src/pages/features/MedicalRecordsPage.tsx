import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { ListRowsSkeleton, PageHeaderSkeleton, Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorAppointments } from '../../services/appointmentService';
import { Appointment, AppointmentDocument, PostConsultAction } from '../../types';

type RecordItem =
  | {
      kind: 'document';
      id: string;
      title: string;
      subtitle: string;
      patientId: string;
      patientName: string;
      date: Date;
      href?: string;
      appointmentId: string;
    }
  | {
      kind: 'note';
      id: string;
      title: string;
      subtitle: string;
      patientId: string;
      patientName: string;
      date: Date;
      content: string;
      appointmentId: string;
      type: string;
    };

const actionLabel = (type: string) => {
  switch (type) {
    case 'prescription_draft':
      return 'Prescription';
    case 'doctor_letter_draft':
      return 'Doctor letter';
    case 'medical_document':
      return 'Medical document';
    case 'session_recording':
      return 'Session recording';
    case 'post_consult_note':
      return 'Consult note';
    default:
      return 'Clinical note';
  }
};

const MedicalRecordsSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <Skeleton className="mb-6 h-11 w-full max-w-md rounded-[10px]" />
    <div className="mb-4 flex gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-full" />
      ))}
    </div>
    <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
      <ListRowsSkeleton rows={6} />
    </div>
  </>
);

export const MedicalRecordsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'documents' | 'notes'>('all');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDoctorAppointments(user.id);
      setAppointments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medical records');
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const records = useMemo(() => {
    const items: RecordItem[] = [];
    appointments.forEach((apt) => {
      (apt.documents ?? []).forEach((doc: AppointmentDocument) => {
        items.push({
          kind: 'document',
          id: `doc-${apt.id}-${doc.id}`,
          title: doc.title || doc.fileName,
          subtitle: `${doc.fileType || 'File'} · ${(doc.fileSize / 1024).toFixed(0)} KB`,
          patientId: apt.patientId,
          patientName: apt.patientName,
          date: doc.createdAt instanceof Date ? doc.createdAt : apt.date,
          href: doc.downloadURL,
          appointmentId: apt.id,
        });
      });
      (apt.postConsultActions ?? []).forEach((action: PostConsultAction) => {
        items.push({
          kind: 'note',
          id: `note-${apt.id}-${action.id}`,
          title: action.title || actionLabel(action.type),
          subtitle: `${actionLabel(action.type)} · ${action.status}`,
          patientId: apt.patientId,
          patientName: apt.patientName,
          date: action.updatedAt instanceof Date ? action.updatedAt : apt.date,
          content: action.content,
          appointmentId: apt.id,
          type: action.type,
        });
      });
    });
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((item) => {
      if (filter === 'documents' && item.kind !== 'document') return false;
      if (filter === 'notes' && item.kind !== 'note') return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.patientName.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.kind === 'note' && item.content.toLowerCase().includes(q))
      );
    });
  }, [records, search, filter]);

  if (isLoading) {
    return (
      <PageShell>
        <MedicalRecordsSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Medical Records"
        description="Browse clinical documents and patient record history."
      />

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65758b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, document, or note..."
            className="h-11 w-full rounded-[10px] border border-[#e1e7ef] bg-white pl-9 pr-3 text-sm text-[#344256] outline-none focus:border-[#427160] focus:ring-2 focus:ring-[#427160]/15"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'documents', 'notes'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`h-9 rounded-full px-3.5 text-sm font-medium capitalize transition-colors ${
                filter === key
                  ? 'bg-[#427160] text-white'
                  : 'border border-[#e1e7ef] bg-white text-[#65758b] hover:border-[#427160]/40 hover:text-[#427160]'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[#65758b]">Total records</p>
          <p className="mt-1 text-2xl font-bold text-[#344256]">{records.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[#65758b]">Documents</p>
          <p className="mt-1 text-2xl font-bold text-[#344256]">
            {records.filter((r) => r.kind === 'document').length}
          </p>
        </div>
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[#65758b]">Clinical notes</p>
          <p className="mt-1 text-2xl font-bold text-[#344256]">
            {records.filter((r) => r.kind === 'note').length}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <DocumentTextIcon className="mx-auto h-10 w-10 text-[#c5ced9]" />
            <p className="mt-3 text-sm font-medium text-[#344256]">No records found</p>
            <p className="mt-1 text-sm text-[#65758b]">
              Documents and consultation notes from appointments will appear here.
            </p>
            <Link
              to="/patients"
              className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-[#427160] px-4 text-sm font-medium text-white hover:bg-[#365c4f]"
            >
              Go to Patients
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f6]">
            {filtered.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4f1] text-[#427160]">
                    {item.kind === 'document' ? (
                      <DocumentArrowDownIcon className="h-5 w-5" />
                    ) : (
                      <DocumentTextIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#344256]">{item.title}</p>
                    <p className="mt-0.5 text-sm text-[#65758b]">
                      {item.patientName} · {item.subtitle}
                    </p>
                    <p className="mt-0.5 text-xs text-[#94a3b8]">
                      {item.date.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    {item.kind === 'note' && (
                      <p className="mt-2 line-clamp-2 text-sm text-[#65758b]">{item.content}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.kind === 'document' && item.href && (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
                    >
                      Open
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/patient-profile/${item.patientId}`)}
                    className="inline-flex h-9 items-center rounded-[10px] bg-[#427160] px-3 text-sm font-medium text-white hover:bg-[#365c4f]"
                  >
                    Patient
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
};
