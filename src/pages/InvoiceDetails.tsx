import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInvoiceById, updateInvoiceRecord, updateInvoiceStatus } from '../services/invoiceService';
import {
  buildDoctorLetterheadFromUser,
  fetchPracticeLogoDataUrl,
  generateInvoicePDF,
} from '../services/invoicePdfService';
import { useAuth } from '../hooks/useAuth';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { getAppointmentById } from '../services/appointmentService';
import { Doctor, Invoice } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';
import { resolvePracticeLogoUrl } from '../lib/doctorAvatar';
import { PageShell } from '../components/page-layout';

const statusLabel = (status: string) =>
  status === 'paid' ? 'Paid' : status === 'issued' ? 'Issued' : 'Pending payment';

const InvoiceDetails: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { navigateBack } = useNavigateWithFallback();
  const { user } = useAuth();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const [invoice, setInvoice] = useState<(Invoice & { patientName?: string }) | null>(null);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoiceId) return;
      setLoading(true);
      try {
        const inv = await getInvoiceById(invoiceId);
        if (!inv) {
          setError('Invoice not found');
          setInvoice(null);
          return;
        }
        setInvoice(inv);
        if (inv.lineItems && inv.lineItems[0]) {
          setDesc(inv.lineItems[0].description || '');
          setAmt(String(inv.lineItems[0].amount || ''));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    void loadInvoice();
  }, [invoiceId]);

  useEffect(() => {
    const enrich = async () => {
      if (!invoice || invoice.patientName) return;
      if (!invoice.appointmentId || !user?.id) return;
      try {
        const apt = await getAppointmentById(user.id, invoice.appointmentId);
        if (apt?.patientName) {
          setInvoice({ ...invoice, patientName: apt.patientName });
        }
      } catch {
        // optional enrichment
      }
    };
    void enrich();
  }, [invoice, user?.id]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-[#65758b]">Loading invoice…</p>
      </PageShell>
    );
  }
  if (error && !invoice) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </PageShell>
    );
  }
  if (!invoice) {
    return (
      <PageShell>
        <p className="text-sm text-[#65758b]">Invoice not found.</p>
      </PageShell>
    );
  }

  const vatRate = invoice.vatRate ?? SA_VAT_RATE;
  const subtotal =
    invoice.subtotalExVat ??
    invoice.lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const vatBreakdown = computeVatBreakdown(subtotal, vatRate);
  const vatAmount = invoice.vatAmount ?? vatBreakdown.vatAmount;
  const totalIncl = invoice.totalAmount ?? vatBreakdown.total;
  const currency = invoice.currency || 'ZAR';
  const logoUrl = resolvePracticeLogoUrl(doctor?.logoUrl, doctor?.profileImageUrl);
  const practiceName = doctor?.practiceName || doctor?.displayName || 'Practice';
  const monogram = practiceName.charAt(0).toUpperCase();

  const handleSaveEdit = async () => {
    const amount = parseFloat(amt) || 0;
    try {
      const updated = await updateInvoiceRecord(invoice.id, {
        lineItems: [
          {
            description: desc,
            quantity: invoice.lineItems?.[0]?.quantity || 1,
            amount,
            icd10Code: invoice.lineItems?.[0]?.icd10Code,
            icd10Description: invoice.lineItems?.[0]?.icd10Description,
          },
        ],
      });
      setInvoice({ ...updated, patientName: invoice.patientName });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    }
  };

  const handleMarkPaid = async () => {
    try {
      await updateInvoiceStatus(invoice.id, 'paid');
      setInvoice({ ...invoice, status: 'paid', paidAt: new Date() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid');
    }
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    setError(null);
    try {
      const letterhead = buildDoctorLetterheadFromUser(doctor);
      const logoDataUrl = await fetchPracticeLogoDataUrl(
        doctor?.id,
        logoUrl || doctor?.logoUrl
      );
      await Promise.race([
        generateInvoicePDF(invoice, {
          ...letterhead,
          logoDataUrl,
          licenseNumber: invoice.hpcsaNumber || doctor?.licenseNumber,
          practiceNumberBhf: invoice.bhfPracticeNumber || doctor?.practiceNumberBhf,
          vatNumber: invoice.vatNumber || doctor?.vatNumber,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('PDF generation timed out. Please try again.')),
            20000
          )
        ),
      ]);
      if (!logoDataUrl) {
        setError(
          'PDF downloaded, but the practice logo could not be embedded. Re-upload your logo under Practice Settings → Letterhead & logo, then try again.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const fmtMoney = (n: number) =>
    `${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  return (
    <PageShell>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigateBack('/invoices')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e1e7ef] bg-white text-lg text-[#344256]"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-[#344256]">Invoice</h1>
        <button
          type="button"
          onClick={() => setEditing((s) => !s)}
          className="rounded-full border border-[#e1e7ef] bg-white px-3 py-1.5 text-sm font-medium text-[#344256]"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!logoUrl ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No practice logo on file. Upload one under{' '}
          <a href="/practice-settings" className="font-semibold underline">
            Practice Settings → Letterhead &amp; logo
          </a>{' '}
          so invoices print with your letterhead.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[20px] border border-[#e1e7ef] bg-white shadow-sm">
        {/* Letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e1e7ef] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${practiceName} logo`}
                className="h-16 w-16 rounded-xl object-contain ring-1 ring-[#e1e7ef]"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#eef2f0] text-2xl font-bold text-anixi-green">
                {monogram}
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-anixi-green">{practiceName}</p>
              {doctor?.specialty ? (
                <p className="text-sm text-[#65758b]">{doctor.specialty}</p>
              ) : null}
            </div>
          </div>
          <div className="text-right text-xs leading-5 text-[#65758b]">
            {doctor?.displayName && doctor.displayName !== practiceName ? (
              <p className="font-medium text-[#344256]">{doctor.displayName}</p>
            ) : null}
            {doctor?.licenseNumber || invoice.hpcsaNumber ? (
              <p>HPCSA: {invoice.hpcsaNumber || doctor?.licenseNumber}</p>
            ) : null}
            {doctor?.practiceNumberBhf || invoice.bhfPracticeNumber ? (
              <p>BHF: {invoice.bhfPracticeNumber || doctor?.practiceNumberBhf}</p>
            ) : null}
            {invoice.vatNumber || doctor?.vatNumber ? (
              <p>VAT: {invoice.vatNumber || doctor?.vatNumber}</p>
            ) : null}
            {doctor?.phoneNumber ? <p>Tel: {doctor.phoneNumber}</p> : null}
            {doctor?.email ? <p>{doctor.email}</p> : null}
            {doctor?.officeAddress ? <p className="max-w-[220px] ml-auto">{doctor.officeAddress}</p> : null}
          </div>
        </div>

        <div className="px-6 py-5 sm:px-8">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tracking-wide text-anixi-green">INVOICE</p>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="text-[#65758b]">Invoice #</span>{' '}
                  <span className="font-semibold text-[#344256]">{invoice.invoiceNumber}</span>
                </p>
                {invoice.paymentReference ? (
                  <p>
                    <span className="text-[#65758b]">Reference</span>{' '}
                    <span className="font-semibold text-[#344256]">{invoice.paymentReference}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex rounded-full bg-[#eef2f0] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-anixi-green">
                {statusLabel(invoice.status)}
              </span>
              <p className="mt-3 text-sm text-[#65758b]">Bill to</p>
              <p className="text-base font-semibold text-[#344256]">
                {invoice.patientName || 'Patient'}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e1e7ef]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-anixi-green px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">
              <span>Description</span>
              <span className="w-12 text-center">Qty</span>
              <span className="w-28 text-right">Amount</span>
            </div>

            {!editing ? (
              invoice.lineItems.map((li, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-[#eef2f6] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-[#344256]">{li.description}</p>
                    {li.icd10Code ? (
                      <p className="mt-0.5 text-xs text-[#65758b]">
                        ICD-10: {li.icd10Code}
                        {li.icd10Description ? ` — ${li.icd10Description}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <span className="w-12 text-center text-[#344256]">{li.quantity}</span>
                  <span className="w-28 text-right font-medium text-[#344256]">
                    {fmtMoney(li.amount * li.quantity)}
                  </span>
                </div>
              ))
            ) : (
              <div className="space-y-2 border-t border-[#eef2f6] p-4">
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-md border border-[#e1e7ef] px-3 py-2 text-sm"
                />
                <input
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  className="w-full rounded-md border border-[#e1e7ef] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  className="rounded-2xl bg-anixi-green px-4 py-2 text-sm font-semibold text-white"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 ml-auto w-full max-w-[260px] space-y-2 text-sm">
            <div className="flex justify-between gap-6 text-[#65758b]">
              <span>Subtotal (ex VAT)</span>
              <span className="tabular-nums text-[#344256]">{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between gap-6 text-[#65758b]">
              <span>VAT ({Math.round(vatRate * 100)}%)</span>
              <span className="tabular-nums text-[#344256]">{fmtMoney(vatAmount)}</span>
            </div>
            <div className="flex justify-between gap-6 border-t border-anixi-green/40 pt-2 text-base font-bold text-anixi-green">
              <span>Total (incl VAT)</span>
              <span className="tabular-nums">{fmtMoney(totalIncl)}</span>
            </div>
          </div>

          <p className="mt-6 text-sm text-[#65758b]">
            Pay by EFT using the payment reference on the PDF. Anixi does not process card payments.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfBusy}
              className="rounded-2xl border border-[#e1e7ef] bg-white px-4 py-2.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
            >
              {pdfBusy ? 'Generating…' : 'Download PDF'}
            </button>
            {invoice.status !== 'paid' && (
              <button
                type="button"
                onClick={() => void handleMarkPaid()}
                className="rounded-2xl bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white"
              >
                Mark as paid
              </button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default InvoiceDetails;
