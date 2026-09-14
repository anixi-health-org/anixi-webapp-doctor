import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, Printer, RefreshCw } from 'lucide-react';
import { PageShell } from '../../components/page-layout';
import { Toast, InvoicePageSkeleton } from '../../components/ui';
import { LetterheadSetupBanner } from '../../components/invoices/LetterheadSetupBanner';
import { PracticePatientPicker } from '../../components/clinic/PracticePatientPicker';
import { TabBar, TabPill } from '../../components/ui/TabPill';
import { useAuth } from '../../hooks/AuthContext';
import { useDoctorCurrency } from '../../hooks/useDoctorCurrency';
import {
  createPracticeInvoice,
  getInvoicesForPractice,
  updateInvoiceStatus,
} from '../../services/invoiceService';
import {
  buildInvoiceLetterhead,
  fetchPracticeLogoDataUrl,
  generateInvoicePDF,
} from '../../services/invoicePdfService';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import { memberDisplayLabel } from '../../services/practiceMemberService';
import { Invoice, InvoiceStatus, PracticeMember } from '../../types';

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
  const { user, practiceSession } = useAuth();
  const { formatAmount } = useDoctorCurrency();
  const practice = practiceSession?.practice;
  const practiceId = practice?.id;
  const doctor = user?.role === 'doctor' ? user : null;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    patientId: '',
    doctorId: '',
    description: 'Consultation',
    amount: '',
  });
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>(
    { visible: false, message: '', type: 'success' }
  );

  const loadData = useCallback(async () => {
    if (!practiceId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const [all, doctors] = await Promise.all([
        getInvoicesForPractice(practiceId),
        listPracticeClinicians(practiceId),
      ]);
      setInvoices(all);
      setClinicians(doctors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clinic invoices');
    } finally {
      setIsLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!practiceId) return;
    setCreating(true);
    try {
      await createPracticeInvoice({
        practiceId,
        patientId: draft.patientId,
        doctorId: draft.doctorId,
        description: draft.description,
        amount: Number(draft.amount),
        bhfPracticeNumber: practice?.bhfPracticeNumber,
      });
      setDraft({ patientId: '', doctorId: '', description: 'Consultation', amount: '' });
      setToast({ visible: true, message: 'Invoice created', type: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        visible: true,
        message: err instanceof Error ? err.message : 'Could not create invoice',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setUpdatingId(invoice.id);
    try {
      const letterhead = buildInvoiceLetterhead({
        doctor,
        practice,
        treatingClinicianName: invoice.doctorName,
      });
      const logoDataUrl = await fetchPracticeLogoDataUrl(undefined, practice?.logoUrl, {
        skipDoctorLogoStore: true,
      });
      await generateInvoicePDF(invoice, { ...letterhead, logoDataUrl });
    } catch {
      setToast({ visible: true, message: 'Failed to generate PDF', type: 'error' });
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
          Track invoices across every clinician in this hospital or clinic. Organisation letterhead
          and BHF number apply. Employed doctors do not bill under their private practice details.
          Payments are still collected offline. Mark status here after the patient pays.
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

      <LetterheadSetupBanner doctor={doctor} practice={practice} className="mb-5" />

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

          <form
            onSubmit={(event) => void handleCreate(event)}
            className="mb-6 rounded-2xl border border-[#dfe6e1] bg-white p-4"
          >
            <p className="text-sm font-semibold text-[#1a4d4d]">Create invoice</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {practiceId ? (
                <PracticePatientPicker
                  practiceId={practiceId}
                  value={draft.patientId}
                  required
                  onChange={(patientId) =>
                    setDraft((current) => ({ ...current, patientId }))
                  }
                />
              ) : (
                <select required disabled className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm">
                  <option value="">Patient</option>
                </select>
              )}
              <select
                required
                value={draft.doctorId}
                onChange={(e) => setDraft((current) => ({ ...current, doctorId: e.target.value }))}
                className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
              >
                <option value="">Clinician</option>
                {clinicians.map((member) => (
                  <option key={member.uid} value={member.uid}>
                    {memberDisplayLabel(member, practice?.ownerId)}
                  </option>
                ))}
              </select>
              <input
                value={draft.description}
                onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                placeholder="Description"
                className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
              />
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft((current) => ({ ...current, amount: e.target.value }))}
                placeholder="Amount (ZAR)"
                className="rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={creating || !draft.patientId || !draft.doctorId || !draft.amount}
                className="rounded-lg bg-[#1a4d4d] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create invoice'}
              </button>
            </div>
          </form>

          <TabBar className="mb-4">
            {(['all', 'issued', 'outstanding', 'paid'] as const).map((key) => (
              <TabPill
                key={key}
                active={filter === key}
                onClick={() => setFilter(key)}
                className="capitalize rounded-[10px]"
              >
                {key}
              </TabPill>
            ))}
          </TabBar>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#dfe6e1] bg-white px-5 py-10 text-center text-sm text-[#65758b]">
              No clinic invoices yet. Create one above, or they will appear here after a consult
              is billed to this practice.
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
                        {invoice.patientName || 'Patient'} · {invoice.doctorName || 'Clinician'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        STATUS_STYLES[invoice.status] || 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base font-semibold text-[#1a4d4d]">
                      {formatAmount(invoice.totalAmount)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingId === invoice.id}
                        onClick={() => void handleDownloadPDF(invoice)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#dfe6e1] px-3 py-1.5 text-xs font-semibold text-[#344256] disabled:opacity-50"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        PDF
                      </button>
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
