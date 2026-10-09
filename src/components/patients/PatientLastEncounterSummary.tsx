import React, { useEffect, useState } from 'react';
import { SparklesIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { AyahScribeSummaryCard } from '../teleconsult/AyahScribeSummaryCard';
import {
  getLastPatientEncounterSummary,
  type PatientEncounterSummary,
} from '../../services/encounterSummaryService';

type Props = {
  patientId: string;
  doctorId?: string;
  practiceId?: string;
  className?: string;
};

function formatWhen(summary: PatientEncounterSummary): string {
  const date = summary.date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return summary.time ? `${date} · ${summary.time}` : date;
}

export const PatientLastEncounterSummary: React.FC<Props> = ({
  patientId,
  doctorId,
  practiceId,
  className = '',
}) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PatientEncounterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const row = await getLastPatientEncounterSummary(patientId, { doctorId, practiceId });
        if (!cancelled) setSummary(row);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, doctorId, practiceId]);

  if (loading) {
    return (
      <section
        className={`rounded-2xl border border-[#e1e7ef] bg-[#f8fafc] px-5 py-4 ${className}`}
      >
        <p className="text-sm text-[#65758b]">Loading last visit summary…</p>
      </section>
    );
  }

  if (!summary) {
    return (
      <section
        className={`rounded-2xl border border-dashed border-[#dfe6e1] bg-[#f8fafc] px-5 py-4 ${className}`}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-[#94a3b8]" />
          <p className="text-sm font-medium text-[#65758b]">No Ayah visit summary yet</p>
        </div>
        <p className="mt-1 text-xs text-[#94a3b8]">
          After a video consultation, Ayah transcribes the call and saves a summary on the visit
          wrap-up page.
        </p>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border border-[#427160]/20 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-[#427160]" />
            <p className="text-sm font-semibold text-[#0E2340]">Last encounter (Ayah)</p>
          </div>
          <p className="mt-1 text-xs text-[#65758b]">
            {formatWhen(summary)} · {summary.typeLabel}
            {summary.doctorName ? ` · ${summary.doctorName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-9 items-center rounded-lg border border-[#e1e7ef] px-3 text-xs font-semibold text-[#344256] hover:border-[#427160]/40"
          >
            {expanded ? 'Hide details' : 'View in detail'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/appointments/${summary.appointmentId}/post-consult`)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#427160] px-3 text-xs font-semibold text-white hover:bg-[#365c4e]"
          >
            Open visit wrap-up
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {summary.note.summary ? (
        <p className="mt-4 text-[15px] leading-relaxed text-[#344256]">{summary.note.summary}</p>
      ) : null}

      {expanded ? (
        <div className="mt-4">
          <AyahScribeSummaryCard note={summary.note} onApply={() => undefined} readOnly />
        </div>
      ) : null}
    </section>
  );
};
