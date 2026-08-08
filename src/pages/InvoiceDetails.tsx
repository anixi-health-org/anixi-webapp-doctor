import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { getInvoiceById, updateInvoiceRecord, updateInvoiceStatus } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/invoicePdfService';
import { useAuth } from '../hooks/useAuth';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { getAppointmentById } from '../services/appointmentService';
import { Doctor, Invoice } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';

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
      <div className="bg-gray-50 min-h-screen p-6">
        <p className="text-sm text-gray-500">Loading invoice…</p>
      </div>
    );
  }
  if (error && !invoice) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <p className="text-sm text-[#65758b]">Invoice not found.</p>
      </div>
    );
  }

  const vatRate = invoice.vatRate ?? SA_VAT_RATE;
  const subtotal =
    invoice.subtotalExVat ??
    invoice.lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const vatBreakdown = computeVatBreakdown(subtotal, vatRate);
  const vatAmount = invoice.vatAmount ?? vatBreakdown.vatAmount;
  const totalIncl = invoice.totalAmount ?? vatBreakdown.total;

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
      await generateInvoicePDF(invoice, {
        displayName: doctor?.displayName || 'Doctor',
        specialty: doctor?.specialty,
        licenseNumber: invoice.hpcsaNumber || doctor?.licenseNumber,
        practiceNumberBhf: invoice.bhfPracticeNumber || doctor?.practiceNumberBhf,
        vatNumber: invoice.vatNumber || doctor?.vatNumber,
        phoneNumber: doctor?.phoneNumber,
        email: doctor?.email,
        officeAddress: doctor?.officeAddress,
        logoUrl: doctor?.logoUrl,
        practiceName: doctor?.practiceName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative mb-4">
          <button
            onClick={() => navigateBack('/invoices')}
            className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-2xl text-foreground"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-center">Invoice</h1>
          <div className="absolute right-0 top-0">
            <button
              onClick={() => setEditing((s) => !s)}
              className="text-sm border px-3 py-1 rounded"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-[30px] border border-[#D8DEE5] bg-white shadow-sm p-6">
          <Card>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Patient</div>
                <div className="font-semibold">{invoice.patientName || 'Unknown'}</div>
                <div className="text-sm text-gray-600 mt-2">Invoice #</div>
                <div className="font-medium">{invoice.invoiceNumber}</div>
                {invoice.paymentReference && (
                  <>
                    <div className="text-sm text-gray-600 mt-2">EFT payment reference</div>
                    <div className="font-medium">{invoice.paymentReference}</div>
                  </>
                )}
                <div className="text-sm text-gray-600 mt-2">Status</div>
                <div className="mt-1">
                  <span className="px-2 py-1 rounded-full border bg-gray-50 text-sm">
                    {invoice.status === 'paid' ? 'Paid' : 'Pending payment'}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-gray-600">Line items (ex VAT)</div>
                  {!editing ? (
                    <div className="mt-2">
                      {invoice.lineItems.map((li, idx) => (
                        <div key={idx} className="flex justify-between py-2 border-b">
                          <div>
                            <div>{li.description}</div>
                            {li.icd10Code && (
                              <div className="text-xs text-gray-500">
                                ICD-10: {li.icd10Code}
                                {li.icd10Description ? ` - ${li.icd10Description}` : ''}
                              </div>
                            )}
                          </div>
                          <div>
                            {(li.amount * li.quantity).toFixed(2)} {invoice.currency || 'ZAR'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <input
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        className="w-full rounded-md border px-3 py-2"
                      />
                      <input
                        value={amt}
                        onChange={(e) => setAmt(e.target.value)}
                        className="w-full rounded-md border px-3 py-2"
                      />
                      <button
                        onClick={() => void handleSaveEdit()}
                        className="bg-[#06A66A] hover:bg-[#099760] text-white px-4 py-2 rounded-2xl"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-1 text-sm text-right text-gray-700">
                  <div>Subtotal (ex VAT): {subtotal.toFixed(2)} {invoice.currency || 'ZAR'}</div>
                  <div>
                    VAT ({Math.round(vatRate * 100)}%): {vatAmount.toFixed(2)}{' '}
                    {invoice.currency || 'ZAR'}
                  </div>
                  <div className="font-bold text-base">
                    Total (incl VAT): {totalIncl.toFixed(2)} {invoice.currency || 'ZAR'}
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-600">
                  Track EFT payments with the reference on the PDF. Anixi does not process card
                  payments.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => void handleDownloadPdf()}
                    disabled={pdfBusy}
                    className="px-4 py-2 border rounded disabled:opacity-50"
                  >
                    {pdfBusy ? 'Generating…' : 'Download PDF'}
                  </button>
                  {invoice.status !== 'paid' && (
                    <button
                      onClick={() => void handleMarkPaid()}
                      className="px-4 py-2 bg-green-600 text-white rounded-2xl"
                    >
                      Mark as paid
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetails;
