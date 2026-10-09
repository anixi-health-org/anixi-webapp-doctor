import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import {
  getPracticeAnalyticsReport,
  type PracticeAnalyticsReport,
} from '../../services/practiceAnalyticsService';
import {
  getPracticeClinicalMetrics,
  type RosterClinicalMetrics,
} from '../../services/clinicalMetricsService';
import { RosterClinicalMetricsGrid } from '../../components/metrics/ClinicalMetricsPanels';
import { activeRooms, roomTypeLabel } from '../../services/roomService';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

const MetricBar: React.FC<{ label: string; value: number; max: number; tone?: 'green' | 'slate' }> = ({
  label,
  value,
  max,
  tone = 'green',
}) => {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-[#65758b]">{label}</span>
        <span className="tabular-nums font-semibold text-[#344256]">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eef2f6]">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            tone === 'green' ? 'bg-anixi-green' : 'bg-[#94a3b8]',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

export const ClinicAdminReportsPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const practice = practiceSession?.practice;
  const [report, setReport] = useState<PracticeAnalyticsReport | null>(null);
  const [clinical, setClinical] = useState<RosterClinicalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [clinicalError, setClinicalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!practice?.id) return;
    setLoading(true);
    setOpsError(null);
    setClinicalError(null);
    setReport(null);
    setClinical(null);

    const [opsResult, clinicalResult] = await Promise.allSettled([
      getPracticeAnalyticsReport(practice.id),
      getPracticeClinicalMetrics(practice.id, { daysBack: 30 }),
    ]);

    if (opsResult.status === 'fulfilled') {
      setReport(opsResult.value);
    } else {
      console.warn('[ClinicAdminReportsPage] operations report failed', opsResult.reason);
      setOpsError(errorMessage(opsResult.reason, 'Could not load operations and billing figures.'));
    }

    if (clinicalResult.status === 'fulfilled') {
      setClinical(clinicalResult.value);
    } else {
      console.warn('[ClinicAdminReportsPage] clinical metrics failed', clinicalResult.reason);
      setClinicalError(
        errorMessage(clinicalResult.reason, 'Could not load clinical overview figures.'),
      );
    }

    setLoading(false);
  }, [practice?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const roomRows = useMemo(() => {
    const rooms = activeRooms(practice);
    if (!report) return [];
    return rooms.map((room) => ({
      room,
      count: report.roomUtilizationToday[room.id] ?? 0,
    }));
  }, [practice, report]);

  const rosterTotal = clinical?.patientCount ?? report?.rosterPatients ?? 0;
  const warriorsWithDoses = clinical?.patientsWithAdherenceData ?? 0;
  const engagementRate = pct(warriorsWithDoses, rosterTotal);

  const statCards = report
    ? [
        { label: 'Today', value: report.appointmentsToday, hint: 'Scheduled visits' },
        { label: 'This week', value: report.appointmentsThisWeek, hint: 'Non-cancelled' },
        { label: 'Completed (month)', value: report.completedThisMonth, hint: 'Closed visits' },
        { label: 'No-shows (month)', value: report.noShowsThisMonth, hint: 'Missed visits' },
        { label: 'Checked in today', value: report.checkedInToday, hint: 'Front desk arrivals' },
        { label: 'Pending bookings', value: report.pendingAppointments, hint: 'Need confirmation' },
        {
          label: 'Invoiced (month)',
          value: formatCurrency(report.invoiceTotalThisMonth),
          hint: `${report.paidInvoicesThisMonth} marked paid`,
        },
        {
          label: 'Medical aid claims',
          value: report.claimsSubmitted,
          hint: `${report.claimsDraft} still in draft`,
        },
      ]
    : [];

  const hasAnyData = Boolean(report || clinical);
  const allFailed = !loading && !hasAnyData && Boolean(opsError || clinicalError);

  const apptCompleted = clinical?.appointments.completed ?? 0;
  const apptTotal = clinical?.appointments.total ?? 0;
  const apptPending = clinical?.appointments.pending ?? 0;
  const apptCancelled = clinical?.appointments.cancelled ?? 0;
  const apptChartMax = Math.max(apptTotal, apptCompleted, apptPending, apptCancelled, 1);

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      {loading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-[#eef2f6]" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((key) => (
              <div key={key} className="h-28 animate-pulse rounded-2xl bg-[#eef2f6]" />
            ))}
          </div>
          <p className="text-sm text-[#65758b]">Pulling live numbers from your clinic…</p>
        </div>
      ) : null}

      {!loading && allFailed ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-800">
          <p className="font-semibold">Reports unavailable</p>
          <p className="mt-1">{opsError || clinicalError}</p>
        </div>
      ) : null}

      {!loading && (clinical || report) ? (
        <div className="mb-8 rounded-2xl border border-[#dfe6e1] bg-gradient-to-br from-[#f4f7f6] via-white to-white p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-anixi-green">Clinic pulse</p>
          <h2 className="mt-1 font-heading text-lg font-bold text-[#1a4d4d] sm:text-xl">
            How your warriors and front desk are doing
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#65758b]">
            Numbers below come from your imported roster, mobile app activity, and bookings. Clinical
            tiles use the last 30 days; operations tiles follow calendar today, this week, and this
            month in your clinic timezone.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">Roster</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#344256]">
                {rosterTotal.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[#65758b]">Patients on file</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
                App engagement
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#344256]">{engagementRate}%</p>
              <p className="mt-1 text-xs text-[#65758b]">
                {warriorsWithDoses.toLocaleString()} logging doses (30d)
              </p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Visits this month
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#344256]">
                {(report?.completedThisMonth ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[#65758b]">
                {(report?.appointmentsToday ?? 0).toLocaleString()} on the diary today
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && clinical ? (
        <div className="mb-10">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-semibold text-[#344256]">Warrior engagement (30 days)</h3>
              <p className="mt-1 text-sm text-[#65758b]">
                Adherence, vitals, symptoms, and documents — aggregated across the full roster.
              </p>
            </div>
            <Link
              to="/clinic/patients"
              className="text-sm font-semibold text-anixi-green hover:underline"
            >
              Open patient roster
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(220px,280px)]">
            <RosterClinicalMetricsGrid metrics={clinical} variant="practice" />
            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Visits in period
              </p>
              <p className="mt-1 text-sm text-[#65758b]">Last {clinical.daysBack} days</p>
              <div className="mt-4 space-y-3">
                <MetricBar label="Completed" value={apptCompleted} max={apptChartMax} />
                <MetricBar label="Pending" value={apptPending} max={apptChartMax} tone="slate" />
                <MetricBar label="Cancelled / no-show" value={apptCancelled} max={apptChartMax} tone="slate" />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[#65758b]">
                Most imported patients start as{' '}
                <span className="font-medium text-[#344256]">pending activation</span> until they join
                the app. Engagement % rises as warriors log doses and vitals.
              </p>
            </div>
          </div>

          {clinical.needingAttention > 0 && clinical.patients.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {clinical.needingAttention.toLocaleString()} warrior
                {clinical.needingAttention === 1 ? '' : 's'} with low adherence — sample
              </p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {clinical.patients.slice(0, 10).map((p) => (
                  <li key={p.patientId} className="text-sm text-amber-900">
                    {p.displayName} — {p.adherence.rate}% adherence
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && clinicalError && !clinical ? (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-semibold">Clinical overview unavailable</p>
          <p className="mt-1">{clinicalError}</p>
        </div>
      ) : null}

      {!loading && report ? (
        <>
          <div className="mb-4">
            <h3 className="font-semibold text-[#344256]">Front desk & billing</h3>
            <p className="mt-1 text-sm text-[#65758b]">
              Live diary counts, check-ins, invoices, and claims — useful for daily huddles.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[#1a4d4d]">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </p>
                <p className="mt-1 text-xs text-[#65758b]">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
            <div className="border-b border-[#eef2f6] px-5 py-3">
              <p className="text-sm font-semibold text-[#1a4d4d]">Room utilization today</p>
              <p className="mt-0.5 text-xs text-[#65758b]">
                Visits assigned to each room on today&apos;s diary
              </p>
            </div>
            {roomRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#65758b]">
                Add rooms under{' '}
                <Link to="/clinic/rooms" className="font-semibold text-anixi-green hover:underline">
                  Rooms
                </Link>{' '}
                to track utilization.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Appointments today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {roomRows.map(({ room, count }) => (
                    <tr key={room.id}>
                      <td className="px-4 py-3 font-medium">{room.name}</td>
                      <td className="px-4 py-3">{roomTypeLabel(room.type)}</td>
                      <td className="px-4 py-3 tabular-nums">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}

      {!loading && opsError && !report ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-semibold">Operations & billing unavailable</p>
          <p className="mt-1">{opsError}</p>
        </div>
      ) : null}
    </PageShell>
  );
};

export default ClinicAdminReportsPage;
