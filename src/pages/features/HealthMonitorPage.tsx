import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Activity, HeartPulse } from 'lucide-react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { PageHeaderSkeleton, Skeleton, StatCardsSkeleton } from '../../components/ui/Skeleton';
import { VitalSeverityBadge } from '../../components/vitals/VitalSeverityBadge';
import { useAuth } from '../../hooks/useAuth';
import {
  attentionReasonLabel,
  getDoctorClinicalMetrics,
  type PatientClinicalMetrics,
  type RosterClinicalMetrics,
} from '../../services/clinicalMetricsService';

const HealthMonitorSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <StatCardsSkeleton count={3} columns={3} />
    <Skeleton className="mb-4 h-11 w-full max-w-md rounded-[10px]" />
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-[12px]" />
      ))}
    </div>
  </>
);

const bandTone = (band: PatientClinicalMetrics['adherence']['band']) => {
  switch (band) {
    case 'excellent':
      return 'bg-emerald-50 text-emerald-700';
    case 'moderate':
      return 'bg-amber-50 text-amber-700';
    case 'low':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export const HealthMonitorPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<RosterClinicalMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'excellent'>('all');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDoctorClinicalMetrics(user.id, {
        daysBack: 30,
        practiceId: practiceSession?.practice?.id,
      });
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health monitor');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, practiceSession?.practice?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!metrics) return [];
    const q = search.trim().toLowerCase();
    return metrics.patients
      .filter((p) => {
        if (filter === 'attention' && !p.needsAttention) return false;
        if (filter === 'excellent' && p.adherence.band !== 'excellent') return false;
        if (!q) return true;
        return p.displayName.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
        return a.adherence.rate - b.adherence.rate;
      });
  }, [metrics, search, filter]);

  if (isLoading) {
    return (
      <PageShell>
        <HealthMonitorSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Health Monitor"
        description="Vitals, adherence, appointments, labs, symptoms, and treatment signals — plus patients needing attention."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center rounded-[10px] border border-[#e1e7ef] bg-white px-3.5 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {metrics && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Patients monitored',
              value: metrics.patientCount,
              icon: HeartPulse,
            },
            {
              label: 'Needs attention',
              value: metrics.needingAttention,
              icon: ExclamationTriangleIcon,
            },
            {
              label: 'Avg adherence (30d)',
              value: metrics.avgAdherence != null ? `${metrics.avgAdherence}%` : '—',
              icon: Activity,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#344256]">{card.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f1] text-[#427160]">
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65758b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients..."
            className="h-11 w-full rounded-[10px] border border-[#e1e7ef] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#427160]"
          />
        </div>
        <div className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['attention', 'Needs attention'],
              ['excellent', 'Excellent'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`h-9 rounded-full px-3.5 text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-[#427160] text-white'
                  : 'border border-[#e1e7ef] bg-white text-[#65758b] hover:border-[#427160]/40 hover:text-[#427160]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((p) => (
          <div
            key={p.patientId}
            className="flex flex-col gap-3 rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#344256]">{p.displayName}</p>
                {p.needsAttention && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Attention
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${bandTone(p.adherence.band)}`}
                >
                  {p.adherence.band === 'no-data' ? 'No data' : p.adherence.band}
                </span>
                <VitalSeverityBadge severity={p.vitals.worst} />
              </div>
              <p className="mt-1 text-sm text-[#65758b]">
                Adherence {p.adherence.rate}% · Vitals {p.vitals.readings} · Appts{' '}
                {p.appointments.total} · Labs {p.labs.documentCount} · Symptoms{' '}
                {p.symptoms.checkIns} · Treatments {p.treatment.activeTreatments}
              </p>
              {p.attentionReasons.length > 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  {p.attentionReasons.map(attentionReasonLabel).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(`/patient-profile/${p.patientId}/vitals-history`)}
                className="inline-flex h-9 items-center rounded-[10px] border border-[#e1e7ef] px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
              >
                Vitals
              </button>
              <button
                type="button"
                onClick={() => navigate(`/patient-profile/${p.patientId}`)}
                className="inline-flex h-9 items-center rounded-[10px] bg-[#427160] px-3 text-sm font-medium text-white hover:bg-[#365c4f]"
              >
                Open
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-[12px] border border-dashed border-[#e1e7ef] bg-white p-8 text-center text-sm text-[#65758b]">
            No patients match this filter.
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default HealthMonitorPage;
