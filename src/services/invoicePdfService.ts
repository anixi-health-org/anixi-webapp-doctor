import jsPDF from 'jspdf';
import { Invoice } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';

export interface DoctorLetterheadData {
  displayName: string;
  specialty?: string;
  licenseNumber?: string;
  practiceNumberBhf?: string;
  vatNumber?: string;
  phoneNumber?: string;
  email?: string;
  officeAddress?: string;
  logoUrl?: string;
  practiceName?: string;
}

// Brand palette
const BRAND_RGB: [number, number, number] = [66, 89, 80];
const BRAND_LIGHT_RGB: [number, number, number] = [238, 242, 240];

function fmtZAR(n: number): string {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d?: Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function toDataURL(url: string): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const format = result.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        resolve({ data: result, format });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePDF(
  invoice: Invoice,
  doctor: DoctorLetterheadData
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoImg: { data: string; format: 'PNG' | 'JPEG' } | null = null;
  if (doctor.logoUrl) {
    logoImg = await toDataURL(doctor.logoUrl);
  }

  const LOGO_SIZE = 26;

  if (logoImg) {
    doc.addImage(logoImg.data, logoImg.format, MARGIN, MARGIN, LOGO_SIZE, LOGO_SIZE);
  }

  // ── Practice / Doctor block (right-aligned) ───────────────────────────────
  const practiceName = doctor.practiceName || doctor.displayName;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BRAND_RGB);
  doc.text(practiceName, PAGE_W - MARGIN, MARGIN + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);

  const infoLines: string[] = [
    doctor.displayName !== practiceName ? doctor.displayName : '',
    doctor.specialty ?? '',
    doctor.licenseNumber ? `HPCSA: ${doctor.licenseNumber}` : '',
    doctor.practiceNumberBhf ? `BHF: ${doctor.practiceNumberBhf}` : '',
    doctor.vatNumber ? `VAT: ${doctor.vatNumber}` : '',
    doctor.phoneNumber ? `Tel: ${doctor.phoneNumber}` : '',
    doctor.email ?? '',
    doctor.officeAddress ?? '',
  ].filter(Boolean);

  let ry = MARGIN + 12;
  for (const line of infoLines) {
    doc.text(line, PAGE_W - MARGIN, ry, { align: 'right' });
    ry += 5;
  }

  // Bottom of header area
  const headerBottom = Math.max(ry, MARGIN + (logoImg ? LOGO_SIZE + 4 : 4)) + 4;

  // ── Horizontal rule ───────────────────────────────────────────────────────
  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, headerBottom, PAGE_W - MARGIN, headerBottom);

  let y = headerBottom + 10;

  // ── INVOICE title ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_RGB);
  doc.text('INVOICE', MARGIN, y);

  // Status badge (top-right of meta block)
  const badgeLabel = invoice.status.toUpperCase();
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(badgeLabel) + 8;
  doc.setFillColor(...BRAND_LIGHT_RGB);
  doc.roundedRect(PAGE_W - MARGIN - badgeW, y - 7, badgeW, 8, 1.5, 1.5, 'F');
  doc.setTextColor(...BRAND_RGB);
  doc.text(badgeLabel, PAGE_W - MARGIN - badgeW / 2, y - 0.5, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice #:   ${invoice.invoiceNumber}`, MARGIN, y);
  y += 5;
  doc.text(`Issued:       ${fmtDate(invoice.issuedAt)}`, MARGIN, y);
  if (invoice.dueDate) {
    y += 5;
    doc.text(`Due:           ${fmtDate(invoice.dueDate)}`, MARGIN, y);
  }
  y += 12;

  // ── Line-items table ──────────────────────────────────────────────────────
  const COL_DESC = MARGIN;
  const COL_QTY = MARGIN + CONTENT_W * 0.62;
  const COL_AMT = MARGIN + CONTENT_W * 0.80;
  const ROW_H = 7;

  // Header row
  doc.setFillColor(...BRAND_RGB);
  doc.rect(MARGIN, y, CONTENT_W, ROW_H + 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', COL_DESC + 2, y + 5);
  doc.text('Qty', COL_QTY + 2, y + 5);
  doc.text('Amount', COL_AMT + 2, y + 5);
  y += ROW_H + 1;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  invoice.lineItems.forEach((item, i) => {
    const fill: [number, number, number] = i % 2 === 0 ? [247, 250, 248] : [255, 255, 255];
    doc.setFillColor(...fill);
    doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
    doc.setFontSize(9);
    const descLines: string[] = [item.description];
    if (item.icd10Code) {
      const icdLabel = item.icd10Description
        ? `ICD-10: ${item.icd10Code} — ${item.icd10Description}`
        : `ICD-10: ${item.icd10Code}`;
      descLines.push(icdLabel);
    }
    const descText = descLines.join('\n');
    const wrappedDesc = doc.splitTextToSize(descText, COL_QTY - COL_DESC - 4) as string[];
    doc.text(wrappedDesc, COL_DESC + 2, y + 4.5);
    doc.text(String(item.quantity), COL_QTY + 2, y + 4.5);
    doc.text(fmtZAR(item.amount * item.quantity), COL_AMT + 2, y + 4.5);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + ROW_H, PAGE_W - MARGIN, y + ROW_H);
    y += ROW_H;
  });

  y += 5;

  const vatRate = invoice.vatRate ?? SA_VAT_RATE;
  const subtotalExVat =
    invoice.subtotalExVat ??
    invoice.lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const vatBreakdown = computeVatBreakdown(subtotalExVat, vatRate);
  const vatAmount = invoice.vatAmount ?? vatBreakdown.vatAmount;
  const totalIncl = invoice.totalAmount ?? vatBreakdown.total;
  const vatPctLabel = `${Math.round(vatRate * 100)}%`;

  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(COL_AMT, y, PAGE_W - MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('Subtotal (ex VAT):', COL_AMT + 2, y);
  doc.text(fmtZAR(subtotalExVat), PAGE_W - MARGIN, y, { align: 'right' });
  y += 6;
  doc.text(`VAT (${vatPctLabel}):`, COL_AMT + 2, y);
  doc.text(fmtZAR(vatAmount), PAGE_W - MARGIN, y, { align: 'right' });
  y += 6;
  doc.setLineWidth(0.5);
  doc.setDrawColor(...BRAND_RGB);
  doc.line(COL_AMT, y, PAGE_W - MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_RGB);
  doc.text('Total (incl VAT):', COL_AMT + 2, y);
  doc.text(fmtZAR(totalIncl), PAGE_W - MARGIN, y, { align: 'right' });

  if (invoice.paidAt) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(22, 163, 74);
    doc.text(`Paid on ${fmtDate(invoice.paidAt)}`, PAGE_W - MARGIN, y, { align: 'right' });
  }

  // ── Notes & payment details ───────────────────────────────────────────────
  const noteSections: string[] = [];
  if (invoice.paymentReference) {
    noteSections.push(`Payment reference: ${invoice.paymentReference}`);
  }
  if (invoice.bankDetailsNote) {
    noteSections.push(`Bank details: ${invoice.bankDetailsNote}`);
  }
  if (invoice.notes) {
    noteSections.push(invoice.notes);
  }

  if (noteSections.length > 0) {
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('Notes:', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    for (const section of noteSections) {
      const noteLines = doc.splitTextToSize(section, CONTENT_W);
      doc.text(noteLines, MARGIN, y);
      y += noteLines.length * 5 + 3;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const FOOTER_Y = 282;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, FOOTER_Y, PAGE_W - MARGIN, FOOTER_Y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(doctor.practiceName || doctor.displayName, MARGIN, FOOTER_Y + 4);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-ZA')}`,
    PAGE_W - MARGIN,
    FOOTER_Y + 4,
    { align: 'right' }
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  doc.save(`${invoice.invoiceNumber}.pdf`);
}
