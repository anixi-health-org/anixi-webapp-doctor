import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import {
  getPracticeAnalyticsReport,
  type PracticeAnalyticsReport,
} from '../../services/practiceAnalyticsService';
import { activeRooms, roomTypeLabel } from '../../services/roomService';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const ClinicAdminReportsPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const practice = practiceSession?.practice;
  const [report, setReport] = useState<PracticeAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!practice?.id) return;
    setLoading(true);
    try {
      const data = await getPracticeAnalyticsReport(practice.id);
      setReport(data);
    } catch (err) {
      console.warn('[ClinicAdminReportsPage] report load failed', err);
    } finally {
      setLoading(false);
    }
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

  const statCards = report
    ? [
        { label: 'Today', value: report.appointmentsToday, hint: 'Appointments' },
        { label: 'This week', value: report.appointmentsThisWeek, hint: 'Appointments' },
        { label: 'Completed (month)', value: report.completedThisMonth, hint: 'Visits' },
        { label: 'No-shows (month)', value: report.noShowsThisMonth, hint: 'Missed visits' },
        { label: 'Checked in today', value: report.checkedInToday, hint: 'Front desk' },
        { label: 'Pending bookings', value: report.pendingAppointments, hint: 'Awaiting confirm' },
        {
          label: 'Invoiced (month)',
          value: formatCurrency(report.invoiceTotalThisMonth),
          hint: `${report.paidInvoicesThisMonth} paid`,
        },
        {
          label: 'Claims',
          value: `${report.claimsSubmitted} submitted`,
          hint: `${report.claimsDraft} draft`,
        },
      ]
    : [];

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Reports"
        description="Practice-wide appointment, billing, and room utilization summaries."
      />

      {loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading reports…</p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-[#1a4d4d]">{card.value}</p>
                <p className="mt-1 text-xs text-[#65758b]">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
            <div className="border-b border-[#eef2f6] px-5 py-3 text-sm font-semibold text-[#1a4d4d]">
              Room utilization today
            </div>
            {roomRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#65758b]">
                Add rooms under Rooms to track utilization.
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
                      <td className="px-4 py-3">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
};

export default ClinicAdminReportsPage;
