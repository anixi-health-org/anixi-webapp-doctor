import type { jsPDF } from 'jspdf';
import type { Invoice, InvoiceLineItem } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from './southAfrica';
import type { DoctorLetterheadData } from './invoiceLetterhead';
import type { PracticeBillingProfile } from './practiceBillingProfile';
import { formatBankingDetailsBlock } from './practiceBillingProfile';

export type SaClinicInvoicePdfContext = {
  medicalAidName?: string;
  medicalAidNumber?: string;
  billingProfile?: PracticeBillingProfile;
};

const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const BRAND: [number, number, number] = [26, 77, 77];

function fmtZAR(n: number): string {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d?: Date): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Details column: tariff/NAPPI text as on clinic invoice samples (e.g. `0190 Consultation/visit`). */
export function formatSaClinicLineDetails(item: InvoiceLineItem): string {
  const desc = (item.description || 'Service').trim();
  const procedure =
    item.procedureCode?.trim() ||
    (/^consultation(\/visit)?$/i.test(desc) ? '0190' : '');
  const nappi = item.nappiCode?.trim();
  if (procedure) {
    const label =
      /^consultation$/i.test(desc) ? 'Consultation/visit' : desc;
    return `${procedure} ${label}`;
  }
  if (nappi) {
    return `${desc} Nappi ${nappi}`;
  }
  return desc;
}

export function resolveSaClinicIcd10Cell(
  item: InvoiceLineItem,
  invoice: Invoice,
): string {
  const fromLine = item.icd10Code?.trim();
  if (fromLine) return fromLine;
  const fromInvoice = invoice.diagnosisCodes?.[0]?.trim();
  return fromInvoice || '';
}

/** SA clinic invoice body — matches docs/prescription & invoice templates/ invoice docx. */
export function renderSaClinicInvoicePdf(
  doc: jsPDF,
  startY: number,
  invoice: Invoice,
  letterhead: DoctorLetterheadData,
  ctx: SaClinicInvoicePdfContext,
  layout: { margin: number; pageWidth: number; contentWidth: number; right: number },
): number {
  const { margin, contentWidth, right } = layout;
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND);
  doc.text('INVOICE', margin, y);
  y += 12;

  const patientName =
    (invoice as Invoice & { patientName?: string }).patientName || 'Patient';
  const rows: [string, string][] = [
    ['Patient name:', patientName],
    ['Medical Aid:', ctx.medicalAidName?.trim() || '—'],
    ['Med Aid number:', ctx.medicalAidNumber?.trim() || '—'],
    ['Date:', fmtDate(invoice.issuedAt)],
  ];

  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(value, margin + 38, y);
    y += 5.5;
  }
  y += 6;

  const colDate = margin;
  const colIcd10 = margin + 24;
  const colDetails = margin + 52;
  const colDebit = right;
  const headerH = 8;
  const lineDate = fmtDate(invoice.issuedAt);

  doc.setFillColor(...BRAND);
  doc.rect(margin, y, contentWidth, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Date', colDate + 2, y + 5.5);
  doc.text('ICD10 CODE', colIcd10 + 2, y + 5.5);
  doc.text('Details', colDetails + 2, y + 5.5);
  doc.text('DEBIT', colDebit - 2, y + 5.5, { align: 'right' });
  y += headerH;

  const vatRate = invoice.vatRate ?? SA_VAT_RATE;
  const subtotalExVat =
    invoice.subtotalExVat ??
    invoice.lineItems.reduce((sum, item) => sum + item.amount * (item.quantity || 1), 0);
  const vatBreakdown = computeVatBreakdown(subtotalExVat, vatRate);
  const vatAmount = invoice.vatAmount ?? vatBreakdown.vatAmount;
  const totalIncl = invoice.totalAmount ?? vatBreakdown.total;
  const vatPct = Math.round(vatRate * 100);

  let rowIndex = 0;
  const drawTableRow = (
    cells: { date: string; icd10: string; details: string; debit: string },
    opts?: { boldDetails?: boolean; boldDebit?: boolean },
  ) => {
    const detailLines = doc.splitTextToSize(cells.details, colDebit - colDetails - 10) as string[];
    const rowH = Math.max(8, detailLines.length * 4.2 + 3);
    const fill: [number, number, number] =
      rowIndex % 2 === 0 ? [248, 250, 249] : [255, 255, 255];
    doc.setFillColor(...fill);
    doc.rect(margin, y, contentWidth, rowH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(cells.date, colDate + 2, y + 5);
    doc.text(cells.icd10, colIcd10 + 2, y + 5);
    doc.setFont('helvetica', opts?.boldDetails ? 'bold' : 'normal');
    let ty = y + 5;
    for (const line of detailLines) {
      doc.text(line, colDetails + 2, ty);
      ty += 4.2;
    }
    doc.setFont('helvetica', opts?.boldDebit ? 'bold' : 'normal');
    if (cells.debit) {
      doc.text(cells.debit, colDebit - 2, y + 5, { align: 'right' });
    }
    y += rowH;
    rowIndex += 1;
  };

  invoice.lineItems.forEach((item) => {
    const debit = item.amount * (item.quantity || 1);
    drawTableRow({
      date: lineDate,
      icd10: resolveSaClinicIcd10Cell(item, invoice),
      details: formatSaClinicLineDetails(item),
      debit: fmtZAR(debit),
    });
  });

  drawTableRow(
    {
      date: '',
      icd10: '',
      details: `Vat@${vatPct}%`,
      debit: fmtZAR(vatAmount),
    },
    { boldDetails: true },
  );

  drawTableRow(
    {
      date: '',
      icd10: '',
      details: 'Total (incl VAT)',
      debit: fmtZAR(totalIncl),
    },
    { boldDetails: true, boldDebit: true },
  );

  y += 4;

  const vatNumber =
    ctx.billingProfile?.vatNumber?.trim() ||
    invoice.vatNumber?.trim() ||
    letterhead.vatNumber?.trim() ||
    '';
  if (vatNumber) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(`VAT Registration Number: ${vatNumber}`, margin, y);
    y += 8;
  }

  const banking =
    invoice.bankDetailsNote?.trim() ||
    formatBankingDetailsBlock(ctx.billingProfile ?? {});
  if (banking) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('OUR BANKING DETAILS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const bankLines = doc.splitTextToSize(banking.replace(/^OUR BANKING DETAILS\s*/i, ''), contentWidth) as string[];
    doc.text(bankLines, margin, y);
    y += bankLines.length * 4.2 + 4;
  }

  if (invoice.paymentReference) {
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`Payment reference: ${invoice.paymentReference}`, margin, y);
    y += 6;
  }

  return y;
}

export type PrescriptionPdfInput = {
  letterhead: DoctorLetterheadData;
  patientName: string;
  appointmentDateLabel: string;
  prescriberName: string;
  content: string;
  icd10Code?: string;
  nappiCode?: string;
  medicalAidName?: string;
  medicalAidNumber?: string;
};

/** SA clinic prescription layout (letterhead + Rx block). */
export function renderSaClinicPrescriptionPdf(
  doc: jsPDF,
  input: PrescriptionPdfInput,
  layout: { margin: number; pageWidth: number; pageHeight: number; contentWidth: number },
): void {
  const { margin, pageHeight, contentWidth } = layout;
  let y = margin;

  const practiceName = (input.letterhead.practiceName || input.prescriberName).trim();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BRAND);
  doc.text(practiceName, margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const headLines = [
    input.letterhead.officeAddress,
    input.letterhead.phoneNumber ? `Tel: ${input.letterhead.phoneNumber}` : '',
    input.letterhead.email,
    input.letterhead.practiceNumberBhf ? `BHF: ${input.letterhead.practiceNumberBhf}` : '',
  ].filter(Boolean) as string[];
  for (const line of headLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }
  y += 4;

  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND);
  doc.text('PRESCRIPTION', margin, y);
  y += 10;

  doc.setFontSize(10);
  const meta: [string, string][] = [
    ['Prescriber:', input.prescriberName],
    ...(input.letterhead.licenseNumber
      ? [['HPCSA:', input.letterhead.licenseNumber] as [string, string]]
      : []),
    ['Patient:', input.patientName],
    ['Date:', input.appointmentDateLabel],
    ...(input.medicalAidName ? [['Medical aid:', input.medicalAidName] as [string, string]] : []),
    ...(input.medicalAidNumber ? [['Med aid no.:', input.medicalAidNumber] as [string, string]] : []),
    ...(input.nappiCode?.trim() ? [['NAPPI:', input.nappiCode.trim()] as [string, string]] : []),
    ...(input.icd10Code?.trim() ? [['ICD-10:', input.icd10Code.trim()] as [string, string]] : []),
  ];

  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(value, margin + 52, y);
    y += 5.5;
  }

  y += 8;
  const boxTop = y;
  const boxH = Math.min(120, pageHeight - y - margin - 24);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.rect(margin, boxTop, contentWidth, boxH);

  y = boxTop + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('℞  Medication and instructions', margin + 6, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const body = input.content.trim() || '—';
  for (const paragraph of body.split(/\n+/)) {
    const lines = doc.splitTextToSize(paragraph, contentWidth - 14) as string[];
    for (const line of lines) {
      if (y > boxTop + boxH - 8) break;
      doc.text(line, margin + 6, y);
      y += 5;
    }
    y += 3;
  }

  const sigY = pageHeight - margin - 12;
  doc.setDrawColor(...MUTED);
  doc.line(margin, sigY, margin + 70, sigY);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Prescriber signature', margin, sigY + 4);
  doc.text(input.prescriberName, margin, sigY + 8);
}
