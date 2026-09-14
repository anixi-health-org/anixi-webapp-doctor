import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  HeartIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Activity, HeartPulse } from 'lucide-react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { PageHeaderSkeleton, Skeleton, StatCardsSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorPatients } from '../../services/patientManagementService';
import {
  getDoctorPatientsAdherenceSummary,
  PatientAdherenceListSummary,
} from '../../services/adherenceService';
import { userFacingLoadError } from '../../services/djangoApiService';
import { Patient } from '../../types';

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

const statusTone = (label: PatientAdherenceListSummary['statusLabel']) => {
  switch (label) {
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [summaries, setSummaries] = useState<Map<string, PatientAdherenceListSummary>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'excellent'>('all');

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await getDoctorPatients(user.id);
      setPatients(list);
      setIsLoading(false);
      const ids = list.map((patient) => patient.id);
      const map =
        ids.length > 0
          ? await getDoctorPatientsAdherenceSummary(user.id, ids, 30)
          : new Map<string, PatientAdherenceListSummary>();
      setSummaries(map);
    } catch (err) {
      setError(userFacingLoadError(err, 'Could not load health monitor'));
      setPatients([]);
      setSummaries(new Map());
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients
      .map((patient) => {
        const summary = summaries.get(patient.id) ?? {
          patientId: patient.id,
          adherenceRate: 0,
          takenCount: 0,
          missedCount: 0,
          pendingCount: 0,
          statusLabel: 'no-data' as const,
        };
        return { patient, summary };
      })
      .filter(({ patient, summary }) => {
        if (filter === 'attention' && !(summary.statusLabel === 'low' || summary.statusLabel === 'moderate')) {
          return false;
        }
        if (filter === 'excellent' && summary.statusLabel !== 'excellent') return false;
        if (!q) return true;
        return (
          (patient.displayName || '').toLowerCase().includes(q) ||
          (patient.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const rank = (label: string) =>
          label === 'low' ? 0 : label === 'moderate' ? 1 : label === 'excellent' ? 2 : 3;
        return rank(a.summary.statusLabel) - rank(b.summary.statusLabel);
      });
  }, [patients, summaries, search, filter]);

  const overview = useMemo(() => {
    const values = Array.from(summaries.values());
    const withData = values.filter((v) => v.statusLabel !== 'no-data');
    const avg =
      withData.length > 0
        ? Math.round(withData.reduce((sum, v) => sum + v.adherenceRate, 0) / withData.length)
        : 0;
    return {
      monitored: patients.length,
      attention: values.filter((v) => v.statusLabel === 'low' || v.statusLabel === 'moderate').length,
      excellent: values.filter((v) => v.statusLabel === 'excellent').length,
      avg,
    };
  }, [patients, summaries]);

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
        description="Track vitals trends and adherence signals across your roster."
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Patients monitored',
            value: overview.monitored,
            icon: HeartPulse,
          },
          {
            label: 'Needs attention',
            value: overview.attention,
            icon: ExclamationTriangleIcon,
          },
          {
            label: 'Avg adherence (30d)',
            value: `${overview.avg}%`,
            icon: Activity,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-[#344256]">{card.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f1] text-[#427160]">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

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
          {([
            ['all', 'All'],
            ['attention', 'Needs attention'],
            ['excellent', 'Excellent'],
          ] as const).map(([key, label]) => (
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

      <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <HeartIcon className="mx-auto h-10 w-10 text-[#c5ced9]" />
            <p className="mt-3 text-sm font-medium text-[#344256]">No patients to monitor</p>
            <p className="mt-1 text-sm text-[#65758b]">
              Connected patients and their adherence signals will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f6]">
            {rows.map(({ patient, summary }) => (
              <li
                key={patient.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef4f1] text-sm font-semibold text-[#427160]">
                    {(patient.displayName || patient.email || '?')
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-[#344256]">
                        {patient.displayName || 'Unnamed patient'}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusTone(summary.statusLabel)}`}
                      >
                        {summary.statusLabel === 'no-data' ? 'No data' : summary.statusLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#65758b]">
                      {summary.adherenceRate}% adherence · {summary.takenCount} taken ·{' '}
                      {summary.missedCount} missed · {summary.pendingCount} pending
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/patient-profile/${patient.id}/adherence-calendar`)}
                    className="inline-flex h-9 items-center rounded-[10px] border border-[#e1e7ef] px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
                  >
                    Adherence
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/patient-profile/${patient.id}`)}
                    className="inline-flex h-9 items-center rounded-[10px] bg-[#427160] px-3 text-sm font-medium text-white hover:bg-[#365c4f]"
                  >
                    Profile
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
