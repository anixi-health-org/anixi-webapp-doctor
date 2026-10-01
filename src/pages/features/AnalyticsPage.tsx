import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Activity, HeartPulse } from 'lucide-react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { PageHeaderSkeleton, Skeleton, StatCardsSkeleton } from '../../components/ui/Skeleton';
import { RosterClinicalMetricsGrid } from '../../components/metrics/ClinicalMetricsPanels';
import { useAuth } from '../../hooks/useAuth';
import {
  getDoctorClinicalMetrics,
  type RosterClinicalMetrics,
} from '../../services/clinicalMetricsService';

const AnalyticsSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <StatCardsSkeleton count={4} />
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 w-full rounded-[12px]" />
      <Skeleton className="h-64 w-full rounded-[12px]" />
    </div>
  </>
);

export const AnalyticsPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<RosterClinicalMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, practiceSession?.practice?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusBars = useMemo(() => {
    if (!metrics) return { bars: [] as Array<{ label: string; value: number; color: string }>, maxStatus: 1 };
    const bars = [
      { label: 'Completed', value: metrics.appointments.completed, color: 'bg-emerald-500' },
      { label: 'Pending', value: metrics.appointments.pending, color: 'bg-amber-400' },
      { label: 'Cancelled', value: metrics.appointments.cancelled, color: 'bg-rose-400' },
      {
        label: 'Other',
        value: Math.max(
          0,
          metrics.appointments.total -
            metrics.appointments.completed -
            metrics.appointments.pending -
            metrics.appointments.cancelled
        ),
        color: 'bg-[#427160]',
      },
    ];
    const maxStatus = Math.max(...bars.map((s) => s.value), 1);
    return { bars, maxStatus };
  }, [metrics]);

  const attentionList = useMemo(
    () => metrics?.patients.filter((p) => p.needsAttention).slice(0, 8) ?? [],
    [metrics]
  );

  if (isLoading) {
    return (
      <PageShell>
        <AnalyticsSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description="Patient, adherence, vitals, appointments, labs, symptoms, and treatment metrics across your roster."
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
        <>
          <div className="mb-6">
            <RosterClinicalMetricsGrid metrics={metrics} />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-[#427160]" />
                <h2 className="font-semibold text-[#344256]">Appointment status mix</h2>
              </div>
              <div className="space-y-4">
                {statusBars.bars.map((bar) => (
                  <div key={bar.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-[#65758b]">{bar.label}</span>
                      <span className="font-medium text-[#344256]">{bar.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#eef2f6]">
                      <div
                        className={`h-full rounded-full ${bar.color}`}
                        style={{ width: `${(bar.value / statusBars.maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                  <h2 className="font-semibold text-[#344256]">Patients needing attention</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/health-monitor')}
                  className="text-sm font-medium text-[#427160] hover:text-[#365c4f]"
                >
                  Open Health Monitor
                </button>
              </div>
              {attentionList.length === 0 ? (
                <p className="text-sm text-[#65758b]">No patients currently flagged.</p>
              ) : (
                <ul className="divide-y divide-[#eef2f6]">
                  {attentionList.map((p) => (
                    <li key={p.patientId} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-[#344256]">{p.displayName}</p>
                        <p className="text-xs text-[#94a3b8]">
                          Adherence {p.adherence.rate}% · Vitals {p.vitals.worst}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/patient-profile/${p.patientId}`)}
                        className="text-sm font-medium text-[#427160]"
                      >
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#427160]" />
              <h2 className="font-semibold text-[#344256]">Quick insights</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[10px] bg-[#f8fafc] p-4">
                <div className="flex items-center gap-2 text-[#427160]">
                  <ClockIcon className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">Pending bookings</p>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#344256]">
                  {metrics.appointments.pending}
                </p>
              </div>
              <div className="rounded-[10px] bg-[#f8fafc] p-4">
                <div className="flex items-center gap-2 text-[#427160]">
                  <HeartPulse className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">Urgent vitals</p>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#344256]">
                  {metrics.vitalsUrgentPatients}
                </p>
              </div>
              <div className="rounded-[10px] bg-[#f8fafc] p-4">
                <div className="flex items-center gap-2 text-[#427160]">
                  <UserGroupIcon className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">Needs attention</p>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#344256]">
                  {metrics.needingAttention}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
};

export default AnalyticsPage;
