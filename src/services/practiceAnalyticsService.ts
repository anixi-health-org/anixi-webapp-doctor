import { listPracticeClaims } from './claimService';
import { getInvoicesForPractice } from './invoiceService';
import { getPracticeDashboardStats } from './practiceDashboardService';

export type PracticeAnalyticsReport = {
  appointmentsToday: number;
  appointmentsThisWeek: number;
  pendingAppointments: number;
  completedThisMonth: number;
  noShowsThisMonth: number;
  checkedInToday: number;
  invoiceTotalThisMonth: number;
  paidInvoicesThisMonth: number;
  claimsDraft: number;
  claimsSubmitted: number;
  roomUtilizationToday: Record<string, number>;
};

export async function getPracticeAnalyticsReport(
  practiceId: string,
): Promise<PracticeAnalyticsReport> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [dashboard, claims, invoices] = await Promise.all([
    getPracticeDashboardStats(practiceId),
    listPracticeClaims(practiceId).catch((err) => {
      console.warn('[practiceAnalytics] claims denied', err);
      return [] as Awaited<ReturnType<typeof listPracticeClaims>>;
    }),
    getInvoicesForPractice(practiceId).catch((err) => {
      console.warn('[practiceAnalytics] invoices denied', err);
      return [] as Awaited<ReturnType<typeof getInvoicesForPractice>>;
    }),
  ]);

  const monthInvoices = invoices.filter((inv) => {
    const created = inv.createdAt;
    return created >= monthStart && created <= monthEnd;
  });

  const invoiceTotalThisMonth = monthInvoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
  const paidInvoicesThisMonth = monthInvoices.filter(
    (inv) => inv.status === 'paid' || inv.paymentStatus === 'completed',
  ).length;

  return {
    appointmentsToday: dashboard.appointmentsToday,
    appointmentsThisWeek: dashboard.appointmentsThisWeek,
    pendingAppointments: dashboard.pendingAppointments,
    completedThisMonth: dashboard.completedThisMonth,
    noShowsThisMonth: dashboard.noShowsThisMonth ?? 0,
    checkedInToday: dashboard.checkedInToday ?? 0,
    invoiceTotalThisMonth,
    paidInvoicesThisMonth,
    claimsDraft: claims.filter((c) => c.status === 'draft').length,
    claimsSubmitted: claims.filter((c) => c.status === 'submitted').length,
    roomUtilizationToday: dashboard.roomUtilizationToday ?? {},
  };
}
