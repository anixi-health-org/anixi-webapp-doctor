import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { getLocalInvoice, updateLocalInvoice } from '../services/invoiceService';
import { jsPDF } from 'jspdf';
import { useAuth } from '../hooks/useAuth';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { getAppointmentById } from '../services/appointmentService';

const InvoiceDetails: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { navigateBack } = useNavigateWithFallback();
  const [invoice, setInvoice] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');

  useEffect(() => {
    if (!invoiceId) return;
    const inv = getLocalInvoice(invoiceId);
    setInvoice(inv);
    if (inv && inv.lineItems && inv.lineItems[0]) {
      setDesc(inv.lineItems[0].description || '');
      setAmt(String(inv.lineItems[0].amount || ''));
    }
  }, [invoiceId]);

  const { user } = useAuth();
  useEffect(() => {
    const enrich = async () => {
      if (!invoice || invoice.patientName) return;
      if (!invoice.appointmentId || !user?.id) return;
      try {
        const apt = await getAppointmentById(user.id, invoice.appointmentId);
        if (apt?.patientName) {
          const updated = updateLocalInvoice(invoice.id, { patientName: apt.patientName });
          setInvoice(updated || { ...invoice, patientName: apt.patientName });
        }
      } catch {

      }
    };
    enrich();
  }, [invoice, user?.id]);

  if (!invoice) return <div className="p-6">Invoice not found.</div>;

  const handleSaveEdit = () => {
    const amount = parseFloat(amt) || 0;
    const updated = updateLocalInvoice(invoice.id, { lineItems: [{ description: desc, amount, currency: invoice.lineItems?.[0]?.currency || 'ZAR' }] });
    setInvoice(updated);
    setEditing(false);
  };

  const handleMarkPaid = () => {
    const updated = updateLocalInvoice(invoice.id, { status: 'paid' });
    setInvoice(updated);
  };

  const generatePdf = async (download = false) => {
    const doc = new jsPDF();

    const pageW = (doc.internal.pageSize as any).getWidth();
    const margin = 20;
    const usableW = pageW - margin * 2;
    const leftW = usableW / 2;
    const rightStartX = margin + leftW + 12;

    let logoLoaded = false;
    let logoDataUrl = '';
    try {
      const resp = await fetch('/anixi.png');
      if (resp.ok) {
        const blob = await resp.blob();
        const reader = new FileReader();
        logoDataUrl = await new Promise((res, rej) => {
          reader.onload = () => res(String(reader.result));
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        logoLoaded = true;
      }
    } catch (e) {

    }

    const maxLogoSize = Math.min(leftW - 24, 80);
    const logoSize = maxLogoSize > 0 ? maxLogoSize : 40;
    const logoX = margin + (leftW - logoSize) / 2;
    const logoY = margin + 12;
    if (logoLoaded) {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    }

    const headerX = rightStartX;
    const headerTopY = margin + 12;
    doc.setFontSize(18);
    doc.text('Invoice', headerX, headerTopY);
    doc.setFontSize(12);
    const metaGap = 8;
    const meta1Y = headerTopY + 10;
    const meta2Y = meta1Y + metaGap;
    const meta3Y = meta2Y + metaGap;
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, headerX, meta1Y);
    doc.text(`Patient: ${invoice.patientName || 'N/A'}`, headerX, meta2Y);

    doc.text(`Status: ${invoice.status}`, headerX, meta3Y);

    const itemsStartY = meta3Y + 18;
    const itemLineGap = 10;
    const amountX = margin + usableW - 4; 
    doc.setFontSize(12);
    doc.text('Line items:', headerX, itemsStartY);
    invoice.lineItems.forEach((li: any, idx: number) => {
      const y = itemsStartY + 8 + idx * itemLineGap;

      doc.text(String(li.description || ''), headerX, y);
      const amtText = `${Number(li.amount).toFixed(2)} ${li.currency}`;

      try {

        (doc as any).text(amtText, amountX, y, { align: 'right' });
      } catch {

        doc.text(amtText, amountX - 4, y);
      }
    });
    const totalY = itemsStartY + 8 + invoice.lineItems.length * itemLineGap + 8;
    doc.setFontSize(14);
    try {
      (doc as any).text(`Total: ${invoice.total} ${invoice.lineItems?.[0]?.currency || 'ZAR'}`, amountX, totalY, { align: 'right' });
    } catch {
      doc.text(`Total: ${invoice.total} ${invoice.lineItems?.[0]?.currency || 'ZAR'}`, amountX - 4, totalY);
    }
    doc.setFontSize(12);

    if (download) {
      doc.save(`${invoice.invoiceNumber}.pdf`);
      return 'PDF ready';
    }
    const url = doc.output('bloburl');
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'Preview opened';
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
            <button onClick={() => setEditing((s) => !s)} className="text-sm border px-3 py-1 rounded">{editing ? 'Cancel' : 'Edit'}</button>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#D8DEE5] bg-white shadow-sm p-6">
          <Card>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Patient</div>
                <div className="font-semibold">{invoice.patientName || 'Unknown'}</div>
                <div className="text-sm text-gray-600 mt-2">Invoice #</div>
                <div className="font-medium">{invoice.invoiceNumber}</div>
                <div className="text-sm text-gray-600 mt-2">Status</div>
                <div className="mt-1"><span className="px-2 py-1 rounded-full border bg-gray-50 text-sm">{invoice.status === 'paid' ? 'Paid' : 'Pending payment'}</span></div>

                <div className="mt-4">
                  <div className="text-sm text-gray-600">Line items</div>
                  {!editing ? (
                    <div className="mt-2">
                      {invoice.lineItems.map((li: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-2 border-b">
                          <div>{li.description}</div>
                          <div>{li.amount.toFixed(2)} {li.currency}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <input value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-md border px-3 py-2" />
                      <input value={amt} onChange={(e) => setAmt(e.target.value)} className="w-full rounded-md border px-3 py-2" />
                      <button onClick={handleSaveEdit} className="bg-[#06A66A] hover:bg-[#099760] text-white px-4 py-2 rounded-2xl">Save</button>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-right font-bold">Total: {invoice.total.toFixed(2)} {invoice.lineItems?.[0]?.currency || 'ZAR'}</div>

                <p className="mt-4 text-sm text-gray-600">Anixi does not process payments. This invoice is for tracking only.</p>

                <div className="mt-4 flex gap-3">
                  <button onClick={() => generatePdf(false)} className="px-4 py-2 border rounded">Preview</button>
                  <button onClick={() => { generatePdf(true); setTimeout(() => { alert('PDF ready'); }, 250); }} className="px-4 py-2 border rounded">Download</button>
                  {invoice.status !== 'paid' && <button onClick={handleMarkPaid} className="px-4 py-2 bg-green-600 text-white rounded-2xl">Mark as paid</button>}
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
