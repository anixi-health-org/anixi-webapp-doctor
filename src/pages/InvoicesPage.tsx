import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  Printer,
  Send,
  CircleDollarSign,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { useDoctorCurrency } from '../hooks/useDoctorCurrency';
import { getInvoicesByDoctor, updateInvoiceStatus, resendInvoice } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/invoicePdfService';
import { Invoice, InvoiceStatus } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Toast, InvoicePageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';

interface Summary {
  issued: number;
  outstanding: number;
  paid: number;
  total: number;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  outstanding: 'bg-amber-50 text-amber-800 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
  { key: 'issued' as const, label: 'Total Issued', icon: Send, color: 'text-blue-600' },
  { key: 'outstanding' as const, label: 'Outstanding', icon: Clock, color: 'text-amber-600' },
  { key: 'paid' as const, label: 'Paid', icon: CircleDollarSign, color: 'text-emerald-600' },
  { key: 'total' as const, label: 'Total Amount', icon: Wallet, color: 'text-gray-900' },
];

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const { formatAmount } = useDoctorCurrency();
  const doctor = user?.role === 'doctor' ? user : null;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary>({ issued: 0, outstanding: 0, paid: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id]);

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast({ visible: false, message: '', type: 'success' });
      }, 3000);
      return () => clearTimeout(timer);
    }
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

      const newSummary: Summary = {
        issued: allInvoices.filter((i) => i.status === 'issued').reduce((sum, i) => sum + i.totalAmount, 0),
        outstanding: allInvoices
          .filter((i) => i.status === 'outstanding')
          .reduce((sum, i) => sum + i.totalAmount, 0),
        paid: allInvoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
        total: allInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      };
      setSummary(newSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices';
      console.error('[InvoicesPage] Error loading invoices:', err);
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
      setToast({ visible: true, message: 'Marked as resent (timestamp updated)', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to resend invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setUpdatingId(invoice.id);
    try {
      await generateInvoicePDF(invoice, {
        displayName: doctor?.displayName ?? 'Doctor',
        specialty: doctor?.specialty,
        licenseNumber: doctor?.licenseNumber,
        phoneNumber: doctor?.phoneNumber,
        email: doctor?.email,
        officeAddress: doctor?.officeAddress,
        logoUrl: doctor?.logoUrl,
        practiceName: doctor?.practiceName,
      });
    } catch {
      setToast({ visible: true, message: 'Failed to generate PDF', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredInvoices = filter === 'all' ? invoices : invoices.filter((inv) => inv.status === filter);

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

      <PageHeader
        title="Invoicing & Financial Tracking"
        description="Manage your invoices and track payment status"
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 font-sans text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {SUMMARY_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-anixi-green">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-sans text-sm text-gray-500">{label}</p>
                  <p className={`font-sans text-2xl font-semibold tabular-nums ${color}`}>
                    {formatAmount(summary[key])}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-anixi-green" />
            All Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <label className="block font-sans text-sm font-medium text-gray-700">Filter by Status</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'issued', 'outstanding', 'paid'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`rounded-full px-3.5 py-1.5 font-sans text-sm font-medium transition ${
                    filter === status
                      ? 'bg-anixi-green text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
              <FileText className="mb-3 h-10 w-10 text-gray-300" />
              <p className="font-heading text-base font-medium text-gray-800">No invoices yet</p>
              <p className="mt-1 font-sans text-sm text-gray-500">
                Invoices are created when appointments are completed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <Card key={invoice.id} className="border-l-4 border-l-anixi-green shadow-soft">
                  <CardContent className="pt-4">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusIcon status={invoice.status} />
                          <h3 className="font-sans font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 font-sans text-xs font-semibold capitalize ${STATUS_STYLES[invoice.status]}`}
                          >
                            {invoice.status}
                          </span>
                        </div>
                        <p className="font-sans text-sm text-gray-500">
                          Issued: {new Date(invoice.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="font-sans text-xl font-semibold tabular-nums text-gray-900">
                        {formatAmount(invoice.totalAmount, invoice.currency)}
                      </p>
                    </div>

                    <div className="mb-3 rounded-lg bg-gray-50 p-3 font-sans text-sm">
                      {invoice.lineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-700">
                          <span>
                            {item.description} ×{item.quantity}
                          </span>
                          <span>{formatAmount(item.amount * item.quantity, invoice.currency)}</span>
                        </div>
                      ))}
                    </div>

                    {invoice.notes && (
                      <p className="mb-3 font-sans text-xs italic text-gray-500">Notes: {invoice.notes}</p>
                    )}

                    <div className="mb-3 space-y-1 font-sans text-xs text-gray-500">
                      <p>
                        <span className="font-medium text-gray-700">Issued:</span>{' '}
                        {new Date(invoice.issuedAt).toLocaleDateString()}
                        {invoice.dueDate && ` · Due: ${new Date(invoice.dueDate).toLocaleDateString()}`}
                      </p>
                      {invoice.paidAt && (
                        <p className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="font-medium text-gray-700">Paid:</span>{' '}
                          {new Date(invoice.paidAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {invoice.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(invoice.id)}
                          disabled={updatingId === invoice.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 font-sans text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Paid
                        </button>
                      )}
                      {invoice.status === 'issued' && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsOutstanding(invoice.id)}
                          disabled={updatingId === invoice.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 font-sans text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Outstanding
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleResendInvoice(invoice.id)}
                        disabled={updatingId === invoice.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 font-sans text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPDF(invoice)}
                        disabled={updatingId === invoice.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 font-sans text-xs font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Download PDF
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3 rounded-xl border border-blue-100 bg-blue-50/80 p-4">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <p className="font-sans text-sm leading-relaxed text-blue-900">
          <span className="font-semibold">How it works:</span> Invoices are created when you complete an
          appointment. Track payment status (Issued, Outstanding, Paid) and resend invoices to patients.
          Anixi does not process payments — funds go directly to you via Phase 2 payment integrations.
        </p>
      </div>
    </PageShell>
  );
};

export default InvoicesPage;
