import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Activity, HeartPulse, TrendingUp } from 'lucide-react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { PageHeaderSkeleton, Skeleton, StatCardsSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorAppointments } from '../../services/appointmentService';
import { getDoctorPatients } from '../../services/patientManagementService';
import { getDoctorPatientsAdherenceSummary } from '../../services/adherenceService';
import { Appointment, Patient } from '../../types';

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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [avgAdherence, setAvgAdherence] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [patientList, aptList] = await Promise.all([
        getDoctorPatients(user.id),
        getDoctorAppointments(user.id),
      ]);
      setPatients(patientList);
      setAppointments(aptList);

      const ids = patientList.map((p) => p.id);
      if (ids.length > 0) {
        const summary = await getDoctorPatientsAdherenceSummary(user.id, ids, 30);
        const rates = Array.from(summary.values())
          .filter((s) => s.statusLabel !== 'no-data')
          .map((s) => s.adherenceRate);
        setAvgAdherence(
          rates.length > 0
            ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
            : null
        );
      } else {
        setAvgAdherence(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthApts = appointments.filter((a) => a.date >= startOfMonth);
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const pending = appointments.filter((a) => a.status === 'pending').length;
    const confirmed = appointments.filter((a) => a.status === 'confirmed').length;
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length;
    const completionRate =
      appointments.length > 0 ? Math.round((completed / appointments.length) * 100) : 0;

    const byMonth = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      byMonth.set(monthKey(d), 0);
    }
    appointments.forEach((a) => {
      const key = monthKey(a.date);
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) || 0) + 1);
    });

    const statusBars = [
      { label: 'Completed', value: completed, color: 'bg-emerald-500' },
      { label: 'Confirmed', value: confirmed, color: 'bg-[#427160]' },
      { label: 'Pending', value: pending, color: 'bg-amber-400' },
      { label: 'Cancelled', value: cancelled, color: 'bg-rose-400' },
    ];
    const maxStatus = Math.max(...statusBars.map((s) => s.value), 1);
    const maxMonth = Math.max(...Array.from(byMonth.values()), 1);

    return {
      totalPatients: patients.length,
      monthAppointments: monthApts.length,
      completionRate,
      avgAdherence,
      byMonth: Array.from(byMonth.entries()),
      statusBars,
      maxStatus,
      maxMonth,
      chronicCount: patients.filter((p) => (p.chronicDiseases?.length ?? 0) > 0).length,
    };
  }, [patients, appointments, avgAdherence]);

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
        description="Practice performance, growth, and outcome insights."
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Active patients',
            value: stats.totalPatients,
            icon: UserGroupIcon,
            hint: `${stats.chronicCount} with chronic conditions`,
          },
          {
            label: 'Appointments this month',
            value: stats.monthAppointments,
            icon: CalendarDaysIcon,
            hint: `${appointments.length} total recorded`,
          },
          {
            label: 'Completion rate',
            value: `${stats.completionRate}%`,
            icon: CheckCircleIcon,
            hint: 'Across all appointments',
          },
          {
            label: 'Avg adherence (30d)',
            value: stats.avgAdherence == null ? '-' : `${stats.avgAdherence}%`,
            icon: HeartPulse,
            hint:
              stats.avgAdherence == null
                ? 'No adherence records in the last 30 days'
                : 'All authorized patients, last 30 days',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-[#344256]">{card.value}</p>
                <p className="mt-1 text-xs text-[#94a3b8]">{card.hint}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f1] text-[#427160]">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#427160]" />
            <h2 className="font-semibold text-[#344256]">Monthly appointment volume</h2>
          </div>
          <div className="flex h-48 items-end gap-3">
            {stats.byMonth.map(([key, count]) => (
              <div key={key} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-medium text-[#65758b]">{count}</span>
                <div
                  className="w-full rounded-t-md bg-[#427160] transition-all"
                  style={{ height: `${Math.max(8, (count / stats.maxMonth) * 140)}px` }}
                />
                <span className="text-[11px] text-[#94a3b8]">{monthLabel(key)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-[#427160]" />
            <h2 className="font-semibold text-[#344256]">Appointment status mix</h2>
          </div>
          <div className="space-y-4">
            {stats.statusBars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-[#65758b]">{bar.label}</span>
                  <span className="font-medium text-[#344256]">{bar.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#eef2f6]">
                  <div
                    className={`h-full rounded-full ${bar.color}`}
                    style={{ width: `${(bar.value / stats.maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#427160]" />
            <h2 className="font-semibold text-[#344256]">Quick insights</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/health-monitor')}
            className="text-sm font-medium text-[#427160] hover:text-[#365c4f]"
          >
            Open Health Monitor
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[10px] bg-[#f8fafc] p-4">
            <div className="flex items-center gap-2 text-[#427160]">
              <ClockIcon className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Pending actions</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#344256]">
              {appointments.filter((a) => a.status === 'pending').length}
            </p>
            <p className="mt-1 text-xs text-[#94a3b8]">Appointments awaiting confirmation</p>
          </div>
          <div className="rounded-[10px] bg-[#f8fafc] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#427160]">
              Follow-up patients
            </p>
            <p className="mt-2 text-2xl font-bold text-[#344256]">{stats.chronicCount}</p>
            <p className="mt-1 text-xs text-[#94a3b8]">Patients with chronic conditions</p>
          </div>
          <div className="rounded-[10px] bg-[#f8fafc] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#427160]">
              Roster coverage
            </p>
            <p className="mt-2 text-2xl font-bold text-[#344256]">{stats.totalPatients}</p>
            <p className="mt-1 text-xs text-[#94a3b8]">Patients connected to your practice</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
};
