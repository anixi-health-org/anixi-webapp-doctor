import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, RefreshCw } from 'lucide-react';
import { PageShell } from '../../components/page-layout';
import { Toast, InvoicePageSkeleton } from '../../components/ui';
import { useAuth } from '../../hooks/AuthContext';
import { useDoctorCurrency } from '../../hooks/useDoctorCurrency';
import { listPracticeMembers } from '../../services/practiceSettingsService';
import {
  getInvoicesForPractice,
  updateInvoiceStatus,
} from '../../services/invoiceService';
import { Invoice, InvoiceStatus } from '../../types';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  issued: 'bg-blue-50 text-blue-700 border-blue-100',
  outstanding: 'bg-amber-50 text-amber-800 border-amber-100',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

function recalculateSummary(list: Invoice[]) {
  return {
    issued: list.filter((i) => i.status === 'issued').reduce((sum, i) => sum + i.totalAmount, 0),
    outstanding: list
      .filter((i) => i.status === 'outstanding')
      .reduce((sum, i) => sum + i.totalAmount, 0),
    paid: list.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
    total: list.reduce((sum, i) => sum + i.totalAmount, 0),
  };
}

export const ClinicAdminInvoicesPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const { formatAmount } = useDoctorCurrency();
  const practiceId = practiceSession?.practice?.id;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>(
    { visible: false, message: '', type: 'success' }
  );

  const loadData = async () => {
    if (!practiceId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const members = await listPracticeMembers(practiceId);
      const doctorIds = members
        .filter((m) => m.status === 'active' && (m.role === 'doctor' || m.isClinician))
        .map((m) => m.uid);
      const all = await getInvoicesForPractice(practiceId, doctorIds);
      setInvoices(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clinic invoices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 3000);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const summary = useMemo(() => recalculateSummary(invoices), [invoices]);
  const visible =
    filter === 'all' ? invoices : invoices.filter((invoice) => invoice.status === filter);

  const handleStatus = async (invoiceId: string, status: InvoiceStatus) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus(invoiceId, status);
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === invoiceId ? { ...invoice, status } : invoice))
      );
      setToast({ visible: true, message: `Invoice marked ${status}`, type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Could not update invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a4d4d]">Clinic invoices</h1>
          <p className="mt-1 text-sm text-[#65758b]">
            Track invoices across every clinician in this practice. Payments are still collected
            offline, mark status here after the patient pays the practice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6e1] bg-white px-3 py-2 text-sm font-medium text-[#1a4d4d]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <InvoicePageSkeleton />
      ) : error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Issued', summary.issued, Clock],
              ['Outstanding', summary.outstanding, FileText],
              ['Paid', summary.paid, CheckCircle2],
              ['Total', summary.total, FileText],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[#dfe6e1] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">
                  {label as string}
                </p>
                <p className="mt-1 text-lg font-semibold text-[#1a4d4d]">
                  {formatAmount(value as number)}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(['all', 'issued', 'outstanding', 'paid'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                  filter === key
                    ? 'bg-[#1a4d4d] text-white'
                    : 'border border-[#dfe6e1] bg-white text-[#344256]'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#dfe6e1] bg-white px-5 py-10 text-center text-sm text-[#65758b]">
              No clinic invoices yet. New invoices created after a consult will appear here when
              they are stamped with this practice.
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((invoice) => (
                <li
                  key={invoice.id}
                  className="rounded-2xl border border-[#dfe6e1] bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1a4d4d]">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-[#65758b]">
                        Patient {invoice.patientId.slice(0, 8)} · Doctor {invoice.doctorId.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[invoice.status]}`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base font-semibold text-[#1a4d4d]">
                      {formatAmount(invoice.totalAmount)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {invoice.status !== 'paid' ? (
                        <button
                          type="button"
                          disabled={updatingId === invoice.id}
                          onClick={() => void handleStatus(invoice.id, 'paid')}
                          className="rounded-lg bg-[#1a4d4d] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingId === invoice.id}
                          onClick={() => void handleStatus(invoice.id, 'outstanding')}
                          className="rounded-lg border border-[#dfe6e1] px-3 py-1.5 text-xs font-semibold text-[#344256] disabled:opacity-50"
                        >
                          Mark outstanding
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {toast.visible ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      ) : null}
    </PageShell>
  );
};

export default ClinicAdminInvoicesPage;
