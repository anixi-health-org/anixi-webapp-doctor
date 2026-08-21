import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Printer,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { useDoctorCurrency } from '../hooks/useDoctorCurrency';
import { getInvoicesByDoctor, updateInvoiceStatus, resendInvoice } from '../services/invoiceService';
import { generateInvoicePDF, buildDoctorLetterheadFromUser, fetchPracticeLogoDataUrl } from '../services/invoicePdfService';
import { Invoice, InvoiceStatus } from '../types';
import { Toast, InvoicePageSkeleton } from '../components/ui';
import { PageShell } from '../components/page-layout';
import { LetterheadSetupBanner } from '../components/invoices/LetterheadSetupBanner';

interface Summary {
  issued: number;
  outstanding: number;
  paid: number;
  total: number;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  issued: 'bg-blue-50 text-blue-700 border-blue-100',
  outstanding: 'bg-amber-50 text-amber-800 border-amber-100',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const StatusIcon: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
  const cls = 'h-4 w-4 shrink-0';
  switch (status) {
    case 'issued':
      return <Send className={cls} />;
    case 'outstanding':
      return <Clock className={cls} />;
    case 'paid':
      return <CheckCircle2 className={cls} />;
    default:
      return <FileText className={cls} />;
  }
};

const SUMMARY_CARDS = [
  {
    key: 'issued' as const,
    label: 'Total Issued',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  {
    key: 'outstanding' as const,
    label: 'Outstanding',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  {
    key: 'paid' as const,
    label: 'Paid',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  {
    key: 'total' as const,
    label: 'Total',
    color: 'text-[#0E2340]',
    bg: 'bg-[#0E2340]',
    dot: 'bg-[#0E2340]',
  },
];

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const { formatAmount } = useDoctorCurrency();
  const doctor = user?.role === 'doctor' ? user : null;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary>({
    issued: 0,
    outstanding: 0,
    paid: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const loadData = async () => {
    if (!doctor?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const allInvoices = await getInvoicesByDoctor(doctor.id);
      setInvoices(allInvoices);
      setSummary(recalculateSummary(allInvoices));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const recalculateSummary = (list: Invoice[]): Summary => ({
    issued: list.filter((i) => i.status === 'issued').reduce((sum, i) => sum + i.totalAmount, 0),
    outstanding: list
      .filter((i) => i.status === 'outstanding')
      .reduce((sum, i) => sum + i.totalAmount, 0),
    paid: list.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
    total: list.reduce((sum, i) => sum + i.totalAmount, 0),
  });

  const handleMarkAsPaid = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus(invoiceId, 'paid');
      setInvoices((prev) => {
        const next = prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: 'paid' as InvoiceStatus } : inv
        );
        setSummary(recalculateSummary(next));
        return next;
      });
      setToast({ visible: true, message: 'Invoice marked as paid', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to update invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAsOutstanding = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus(invoiceId, 'outstanding');
      setInvoices((prev) => {
        const next = prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: 'outstanding' as InvoiceStatus } : inv
        );
        setSummary(recalculateSummary(next));
        return next;
      });
      setToast({ visible: true, message: 'Invoice marked as outstanding', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to update invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResendInvoice = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await resendInvoice(invoiceId);
      setToast({ visible: true, message: 'Marked as resent', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to resend invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setUpdatingId(invoice.id);
    try {
      const letterhead = buildDoctorLetterheadFromUser(doctor);
      const logoDataUrl = await fetchPracticeLogoDataUrl(
        doctor?.id,
        doctor?.logoUrl
      );
      await generateInvoicePDF(invoice, { ...letterhead, logoDataUrl });
    } catch {
      setToast({ visible: true, message: 'Failed to generate PDF', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredInvoices =
    filter === 'all' ? invoices : invoices.filter((inv) => inv.status === filter);

  if (isLoading) {
    return (
      <PageShell maxWidth="wide">
        <InvoicePageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">Invoices</h1>
          <p className="mt-1 text-[13px] text-[#65758b]">
            Manage invoices and track payment status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <LetterheadSetupBanner doctor={doctor} className="mb-5" />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {SUMMARY_CARDS.map(({ key, label, dot }) => (
          <div
            key={key}
            className={`relative overflow-hidden rounded-xl border border-[#e1e7ef] px-5 py-4 shadow-sm ${
              key === 'total' ? 'bg-[#0E2340]' : 'bg-white'
            }`}
          >
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${
              key === 'total' ? 'text-white/60' : 'text-[#8FA0B6]'
            }`}>
              {label}
            </p>
            <p className={`mt-2 text-[22px] font-bold tabular-nums ${
              key === 'total' ? 'text-white' : 'text-[#0E2340]'
            }`}>
              {formatAmount(summary[key])}
            </p>
            <span className={`absolute right-4 top-4 inline-block h-2 w-2 rounded-full ${
              key === 'total' ? 'bg-white/30' : dot
            }`} />
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div className="overflow-hidden rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-[#0E2340]">All invoices</h2>
            <span className="rounded-md bg-[#f0f4f8] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#65758b]">
              {filteredInvoices.length}
            </span>
          </div>
          <div className="flex gap-1 rounded-lg bg-[#f0f4f8] p-1">
            {(['all', 'issued', 'outstanding', 'paid'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                  filter === status
                    ? 'bg-white text-[#0E2340] shadow-sm'
                    : 'text-[#65758b] hover:text-[#344256]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#e1e7ef]">
          {filteredInvoices.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f4f8]">
                <FileText className="h-7 w-7 text-[#8FA0B6]" />
              </div>
              <p className="mt-4 text-[15px] font-semibold text-[#0E2340]">No invoices yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-[#65758b]">
                Invoices appear here when you complete appointments. Track Issued, Outstanding, and
                Paid status from this list.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#eef2f6]">
              {filteredInvoices.map((invoice) => (
                <li key={invoice.id} className="px-5 py-4 transition hover:bg-[#fafbfc]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusIcon status={invoice.status} />
                        <h3 className="text-sm font-semibold text-[#0E2340]">{invoice.invoiceNumber}</h3>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[invoice.status]}`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-[#65758b]">
                        Issued {new Date(invoice.issuedAt).toLocaleDateString('en-GB')}
                        {invoice.dueDate
                          ? ` · Due ${new Date(invoice.dueDate).toLocaleDateString('en-GB')}`
                          : ''}
                        {invoice.paidAt
                          ? ` · Paid ${new Date(invoice.paidAt).toLocaleDateString('en-GB')}`
                          : ''}
                      </p>
                      <div className="mt-3 space-y-1 rounded-lg bg-[#f8fafc] px-3.5 py-2.5 text-[13px] text-[#65758b]">
                        {invoice.lineItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-3">
                            <span>
                              {item.description} ×{item.quantity}
                            </span>
                            <span className="font-medium tabular-nums text-[#344256]">
                              {formatAmount(item.amount * item.quantity, invoice.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {invoice.notes ? (
                        <p className="mt-2 text-xs italic text-[#94a3b8]">Notes: {invoice.notes}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
                      <p className="text-right text-lg font-bold tabular-nums text-[#0E2340]">
                        {formatAmount(invoice.totalAmount, invoice.currency)}
                      </p>
                      <div className="flex flex-wrap gap-1.5 sm:justify-end">
                        {invoice.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleMarkAsPaid(invoice.id)}
                            disabled={updatingId === invoice.id}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark paid
                          </button>
                        )}
                        {invoice.status === 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleMarkAsOutstanding(invoice.id)}
                            disabled={updatingId === invoice.id}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Outstanding
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleResendInvoice(invoice.id)}
                          disabled={updatingId === invoice.id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e1e7ef] bg-white px-3 text-xs font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340] disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadPDF(invoice)}
                          disabled={updatingId === invoice.id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e1e7ef] bg-white px-3 text-xs font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340] disabled:opacity-50"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="mt-5 flex gap-3 rounded-xl border border-[#d4e0d8] bg-[#f0f5f2] px-5 py-4">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-anixi-green/10 text-anixi-green">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </span>
        <p className="text-[13px] leading-relaxed text-[#344256]">
          <span className="font-semibold">How it works:</span> Invoices are created when you
          complete an appointment. Track Issued, Outstanding, and Paid status and resend invoices
          to patients. Anixi does not process payments - funds go directly to you via Phase 2
          payment integrations.
        </p>
      </div>
    </PageShell>
  );
};

export default InvoicesPage;
