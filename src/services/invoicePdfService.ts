import jsPDF from 'jspdf';
import { doc, getDoc } from 'firebase/firestore';
import { getBytes, getDownloadURL, ref } from 'firebase/storage';
import { Invoice } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';
import { resolvePracticeLogoUrl } from '../lib/doctorAvatar';
import { db, storage } from '../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../shared/constants';

export interface DoctorLetterheadData {
  doctorId?: string;
  displayName: string;
  specialty?: string;
  licenseNumber?: string;
  practiceNumberBhf?: string;
  vatNumber?: string;
  phoneNumber?: string;
  email?: string;
  officeAddress?: string;
  logoUrl?: string;
  /** Face photo — only used for letterhead when it is actually a stored practice logo. */
  profileImageUrl?: string;
  practiceName?: string;
  /**
   * Optional pre-encoded logo (data:image/...;base64,...). When set, PDF skips
   * network logo loading — use this when the UI already has the logo on screen.
   */
  logoDataUrl?: string;
}

const BRAND_RGB: [number, number, number] = [66, 89, 80];
const BRAND_LIGHT_RGB: [number, number, number] = [238, 242, 240];
const MUTED_RGB: [number, number, number] = [100, 116, 139];
const INK_RGB: [number, number, number] = [30, 41, 59];

type LogoImage = { data: string; format: 'PNG' | 'JPEG'; width: number; height: number };

function fmtZAR(n: number): string {
  return `R ${n.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(d?: Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function resolveLogoUrl(doctor: DoctorLetterheadData): string | undefined {
  return resolvePracticeLogoUrl(doctor.logoUrl, doctor.profileImageUrl);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Pull the Storage object path out of a Firebase download URL. */
function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const marker = '/o/';
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    const rest = url.slice(idx + marker.length);
    const encoded = rest.split('?')[0] || '';
    const path = decodeURIComponent(encoded);
    return path || null;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let binary = '';
    for (let j = 0; j < chunk.length; j += 1) {
      binary += String.fromCharCode(chunk[j]!);
    }
    chunks.push(binary);
  }
  return btoa(chunks.join(''));
}

function detectImageFormat(bytes: Uint8Array): 'PNG' | 'JPEG' {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return 'PNG';
  }
  return 'JPEG';
}

async function logoFromArrayBuffer(buffer: ArrayBuffer): Promise<LogoImage | null> {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length) return null;
  const format = detectImageFormat(bytes);
  const mime = format === 'PNG' ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buffer)}`;

  // Decode dimensions from a local blob — no CORS (bytes already in memory).
  try {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(buffer)], { type: mime }));
    const width = bitmap.width || 1;
    const height = bitmap.height || 1;
    bitmap.close();
    return { data: dataUrl, format, width, height };
  } catch {
    // jsPDF can still render without perfect dimensions
    return { data: dataUrl, format, width: 400, height: 400 };
  }
}

async function logoFromDataUrl(dataUrl: string): Promise<LogoImage | null> {
  if (!dataUrl.startsWith('data:image/')) return null;
  const format: 'PNG' | 'JPEG' = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
  try {
    const res = await fetch(dataUrl);
    const buffer = await res.arrayBuffer();
    const bitmap = await createImageBitmap(new Blob([buffer]));
    const width = bitmap.width || 1;
    const height = bitmap.height || 1;
    bitmap.close();
    return { data: dataUrl, format, width, height };
  } catch {
    return { data: dataUrl, format, width: 400, height: 400 };
  }
}

async function logoFromStoragePath(path: string): Promise<LogoImage | null> {
  const buffer = await withTimeout(getBytes(ref(storage, path)), 8000, `getBytes ${path}`);
  return logoFromArrayBuffer(buffer);
}

/**
 * Load practice logo for PDF via authenticated Storage getBytes (no CORS).
 * Never blocks PDF generation longer than ~10s.
 */
async function loadPracticeLogoForPdf(
  doctorId: string | undefined,
  logoUrl?: string,
  logoDataUrl?: string
): Promise<LogoImage | null> {
  const load = async () => {
    if (logoDataUrl) {
      const fromData = await logoFromDataUrl(logoDataUrl);
      if (fromData) return fromData;
    }

    const paths: string[] = [];
    if (logoUrl) {
      const fromUrl = storagePathFromDownloadUrl(logoUrl);
      if (fromUrl) paths.push(fromUrl);
    }
    if (doctorId) {
      paths.push(`doctor-logos/${doctorId}/logo.jpg`);
      paths.push(`doctor-logos/${doctorId}/logo.png`);
    }

    const tried = new Set<string>();
    for (const path of paths) {
      if (!path || tried.has(path)) continue;
      tried.add(path);
      try {
        const logo = await logoFromStoragePath(path);
        if (logo) return logo;
      } catch (error) {
        console.warn('[invoicePdf] storage logo miss:', path, error);
      }
    }

    return null;
  };

  try {
    return await withTimeout(load(), 10000, 'logo load');
  } catch (error) {
    console.warn('[invoicePdf] logo load skipped:', error);
    return null;
  }
}

/** Fit logo into a box while preserving aspect ratio. */
function fitLogoBox(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (!naturalW || !naturalH) return { w: maxW, h: maxH };
  const ratio = naturalW / naturalH;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}

/** Public helper so the invoice page can pre-load the logo before PDF generation. */
export async function fetchPracticeLogoDataUrl(
  doctorId: string | undefined,
  logoUrl?: string | null
): Promise<string | undefined> {
  const logo = await loadPracticeLogoForPdf(
    doctorId,
    logoUrl?.trim() || undefined
  );
  return logo?.data;
}

export function buildDoctorLetterheadFromUser(doctor: {
  id?: string;
  displayName?: string;
  specialty?: string;
  licenseNumber?: string;
  practiceNumberBhf?: string;
  vatNumber?: string;
  phoneNumber?: string;
  email?: string;
  officeAddress?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  practiceName?: string;
} | null | undefined): DoctorLetterheadData {
  return {
    doctorId: doctor?.id,
    displayName: doctor?.displayName || 'Doctor',
    specialty: doctor?.specialty,
    licenseNumber: doctor?.licenseNumber,
    practiceNumberBhf: doctor?.practiceNumberBhf,
    vatNumber: doctor?.vatNumber,
    phoneNumber: doctor?.phoneNumber,
    email: doctor?.email,
    officeAddress: doctor?.officeAddress,
    logoUrl: doctor?.logoUrl,
    profileImageUrl: doctor?.profileImageUrl,
    practiceName: doctor?.practiceName,
  };
}

/**
 * Refresh letterhead from Firestore + Storage so PDF generation isn't stuck
 * with a stale auth session missing logoUrl.
 */
async function enrichLetterhead(
  doctor: DoctorLetterheadData
): Promise<DoctorLetterheadData> {
  const doctorId = doctor.doctorId?.trim();
  if (!doctorId) return doctor;

  let logoUrl = doctor.logoUrl;
  let practiceName = doctor.practiceName;
  let specialty = doctor.specialty;
  let licenseNumber = doctor.licenseNumber;
  let practiceNumberBhf = doctor.practiceNumberBhf;
  let vatNumber = doctor.vatNumber;
  let phoneNumber = doctor.phoneNumber;
  let email = doctor.email;
  let officeAddress = doctor.officeAddress;
  let displayName = doctor.displayName;
  let profileImageUrl = doctor.profileImageUrl;

  try {
    const [doctorSnap, userSnap] = await withTimeout(
      Promise.all([
        getDoc(doc(db, DOCTORS_COLLECTION, doctorId)),
        getDoc(doc(db, USERS_COLLECTION, doctorId)),
      ]),
      5000,
      'letterhead enrich'
    );
    const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};
    const userData = userSnap.exists() ? userSnap.data() : {};
    const branding =
      (userData.practiceBranding as Record<string, unknown> | undefined) ?? {};

    logoUrl = resolvePracticeLogoUrl(
      (doctorData.logoUrl as string | undefined) ||
        (branding.logoUrl as string | undefined) ||
        logoUrl,
      (doctorData.profileImageUrl as string | undefined) || profileImageUrl
    );
    practiceName =
      (doctorData.practiceName as string | undefined) ||
      (branding.practiceName as string | undefined) ||
      practiceName;
    specialty =
      (doctorData.specialty as string | undefined) ||
      (doctorData.medicalSpecialty as string | undefined) ||
      specialty;
    licenseNumber =
      (doctorData.licenseNumber as string | undefined) ||
      (doctorData.hpcsaRegistrationNumber as string | undefined) ||
      licenseNumber;
    practiceNumberBhf =
      (doctorData.practiceNumberBhf as string | undefined) ||
      (doctorData.practiceNumber as string | undefined) ||
      practiceNumberBhf;
    vatNumber = (doctorData.vatNumber as string | undefined) || vatNumber;
    phoneNumber =
      (doctorData.phoneNumber as string | undefined) ||
      (userData.phoneNumber as string | undefined) ||
      phoneNumber;
    email =
      (doctorData.email as string | undefined) ||
      (userData.email as string | undefined) ||
      email;
    officeAddress =
      (doctorData.officeAddress as string | undefined) ||
      (doctorData.practiceAddress as string | undefined) ||
      officeAddress;
    displayName =
      (doctorData.displayName as string | undefined) ||
      (doctorData.fullName as string | undefined) ||
      displayName;
    profileImageUrl =
      (doctorData.profileImageUrl as string | undefined) || profileImageUrl;
  } catch (error) {
    console.warn('[invoicePdf] enrich letterhead failed', error);
  }

  if (!logoUrl) {
    try {
      logoUrl = await withTimeout(
        getDownloadURL(ref(storage, `doctor-logos/${doctorId}/logo.jpg`)),
        4000,
        'logo download URL'
      );
    } catch {
      // no uploaded logo
    }
  }

  return {
    ...doctor,
    doctorId,
    displayName,
    specialty,
    licenseNumber,
    practiceNumberBhf,
    vatNumber,
    phoneNumber,
    email,
    officeAddress,
    logoUrl,
    profileImageUrl,
    practiceName,
    logoDataUrl: doctor.logoDataUrl,
  };
}

export async function generateInvoicePDF(
  invoice: Invoice,
  doctorInput: DoctorLetterheadData
): Promise<void> {
  const doctor = await enrichLetterhead(doctorInput);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const RIGHT = PAGE_W - MARGIN;

  const practiceName = (doctor.practiceName || doctor.displayName).trim();
  const logoUrl = resolveLogoUrl(doctor);
  const logoImg = await loadPracticeLogoForPdf(
    doctor.doctorId,
    logoUrl,
    doctor.logoDataUrl || doctorInput.logoDataUrl
  );

  // ── Letterhead ────────────────────────────────────────────────────────────
  const LOGO_MAX_W = 48;
  const LOGO_MAX_H = 32;
  let headerBottom = MARGIN;
  let textLeft = MARGIN;

  if (logoImg) {
    const box = fitLogoBox(logoImg.width, logoImg.height, LOGO_MAX_W, LOGO_MAX_H);
    doc.addImage(logoImg.data, logoImg.format, MARGIN, MARGIN, box.w, box.h);
    headerBottom = Math.max(headerBottom, MARGIN + box.h);
    textLeft = MARGIN + box.w + 6;
  }

  // Practice name sits with the logo as a true letterhead (left), details right.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(logoImg ? 13 : 16);
  doc.setTextColor(...BRAND_RGB);
  if (logoImg) {
    doc.text(practiceName, textLeft, MARGIN + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED_RGB);
    if (doctor.specialty) {
      doc.text(doctor.specialty, textLeft, MARGIN + 13);
    }
  } else {
    doc.text(practiceName, MARGIN, MARGIN + 7);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_RGB);

  const infoLines = [
    !logoImg && doctor.displayName && doctor.displayName !== practiceName
      ? doctor.displayName
      : '',
    !logoImg ? doctor.specialty ?? '' : '',
    doctor.licenseNumber ? `HPCSA: ${doctor.licenseNumber}` : '',
    doctor.practiceNumberBhf ? `BHF: ${doctor.practiceNumberBhf}` : '',
    doctor.vatNumber ? `VAT: ${doctor.vatNumber}` : '',
    doctor.phoneNumber ? `Tel: ${doctor.phoneNumber}` : '',
    doctor.email ?? '',
    doctor.officeAddress ?? '',
  ].filter(Boolean);

  let ry = MARGIN + 5;
  for (const line of infoLines) {
    const wrapped = doc.splitTextToSize(line, 78) as string[];
    for (const w of wrapped) {
      doc.text(w, RIGHT, ry, { align: 'right' });
      ry += 4.2;
    }
  }
  headerBottom = Math.max(headerBottom, ry, MARGIN + (logoImg ? LOGO_MAX_H : 14)) + 4;

  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, headerBottom, RIGHT, headerBottom);

  let y = headerBottom + 10;

  // ── Title + status ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...BRAND_RGB);
  doc.text('INVOICE', MARGIN, y);

  const badgeLabel = (invoice.status || 'issued').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const badgeW = Math.max(doc.getTextWidth(badgeLabel) + 10, 22);
  doc.setFillColor(...BRAND_LIGHT_RGB);
  doc.roundedRect(RIGHT - badgeW, y - 6.5, badgeW, 8, 1.5, 1.5, 'F');
  doc.setTextColor(...BRAND_RGB);
  doc.text(badgeLabel, RIGHT - badgeW / 2, y - 1, { align: 'center' });

  y += 8;

  // ── Meta + bill-to ────────────────────────────────────────────────────────
  const metaLeft = MARGIN;
  const billLeft = MARGIN + CONTENT_W * 0.55;
  const metaTop = y;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_RGB);
  doc.text('Invoice #', metaLeft, y);
  doc.setTextColor(...INK_RGB);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, metaLeft + 28, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED_RGB);
  doc.text('Issued', metaLeft, y);
  doc.setTextColor(...INK_RGB);
  doc.text(fmtDate(invoice.issuedAt), metaLeft + 28, y);
  if (invoice.dueDate) {
    y += 5;
    doc.setTextColor(...MUTED_RGB);
    doc.text('Due', metaLeft, y);
    doc.setTextColor(...INK_RGB);
    doc.text(fmtDate(invoice.dueDate), metaLeft + 28, y);
  }
  if (invoice.paymentReference) {
    y += 5;
    doc.setTextColor(...MUTED_RGB);
    doc.text('Reference', metaLeft, y);
    doc.setTextColor(...INK_RGB);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.paymentReference, metaLeft + 28, y);
    doc.setFont('helvetica', 'normal');
  }

  const patientName =
    (invoice as Invoice & { patientName?: string }).patientName || 'Patient';
  let by = metaTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text('BILL TO', billLeft, by);
  by += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK_RGB);
  doc.text(patientName, billLeft, by);

  y = Math.max(y, by) + 12;

  // ── Line items ────────────────────────────────────────────────────────────
  const COL_DESC = MARGIN;
  const COL_QTY = MARGIN + CONTENT_W * 0.68;
  const COL_AMT = RIGHT;
  const HEADER_H = 8;

  doc.setFillColor(...BRAND_RGB);
  doc.rect(MARGIN, y, CONTENT_W, HEADER_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', COL_DESC + 2.5, y + 5.5);
  doc.text('Qty', COL_QTY, y + 5.5, { align: 'center' });
  doc.text('Amount', COL_AMT - 2.5, y + 5.5, { align: 'right' });
  y += HEADER_H;

  invoice.lineItems.forEach((item, i) => {
    const descMaxW = COL_QTY - COL_DESC - 10;
    const primary = item.description || 'Service';
    const icd = item.icd10Code
      ? item.icd10Description
        ? `ICD-10: ${item.icd10Code} — ${item.icd10Description}`
        : `ICD-10: ${item.icd10Code}`
      : '';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const primaryLines = doc.splitTextToSize(primary, descMaxW) as string[];
    doc.setFontSize(8);
    const icdLines = icd
      ? (doc.splitTextToSize(icd, descMaxW) as string[])
      : [];
    const lineCount = primaryLines.length + icdLines.length;
    const rowH = Math.max(9, lineCount * 4.2 + 4);

    const fill: [number, number, number] =
      i % 2 === 0 ? [247, 250, 248] : [255, 255, 255];
    doc.setFillColor(...fill);
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');

    let ty = y + 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK_RGB);
    for (const line of primaryLines) {
      doc.text(line, COL_DESC + 2.5, ty);
      ty += 4.2;
    }
    if (icdLines.length) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED_RGB);
      for (const line of icdLines) {
        doc.text(line, COL_DESC + 2.5, ty);
        ty += 4;
      }
    }

    doc.setFontSize(9);
    doc.setTextColor(...INK_RGB);
    doc.text(String(item.quantity), COL_QTY, y + 5.5, { align: 'center' });
    doc.text(fmtZAR(item.amount * item.quantity), COL_AMT - 2.5, y + 5.5, {
      align: 'right',
    });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + rowH, RIGHT, y + rowH);
    y += rowH;
  });

  y += 8;

  // ── Totals (two clear columns — no overlap) ───────────────────────────────
  const vatRate = invoice.vatRate ?? SA_VAT_RATE;
  const subtotalExVat =
    invoice.subtotalExVat ??
    invoice.lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const vatBreakdown = computeVatBreakdown(subtotalExVat, vatRate);
  const vatAmount = invoice.vatAmount ?? vatBreakdown.vatAmount;
  const totalIncl = invoice.totalAmount ?? vatBreakdown.total;
  const vatPctLabel = `${Math.round(vatRate * 100)}%`;

  const TOTALS_W = 78;
  const totalsLeft = RIGHT - TOTALS_W;
  const labelX = totalsLeft;
  const valueX = RIGHT;

  const drawTotalRow = (
    label: string,
    value: string,
    opts?: { bold?: boolean; size?: number; color?: [number, number, number] }
  ) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 9);
    doc.setTextColor(...(opts?.color ?? MUTED_RGB));
    doc.text(label, labelX, y);
    doc.setTextColor(...(opts?.color ?? INK_RGB));
    doc.text(value, valueX, y, { align: 'right' });
    y += 6;
  };

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(totalsLeft, y, RIGHT, y);
  y += 7;

  drawTotalRow('Subtotal (ex VAT)', fmtZAR(subtotalExVat));
  drawTotalRow(`VAT (${vatPctLabel})`, fmtZAR(vatAmount));

  // Separator sits between VAT and Total — keep clear of text baselines.
  y += 1;
  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.55);
  doc.line(totalsLeft, y, RIGHT, y);
  y += 6;

  drawTotalRow('Total (incl VAT)', fmtZAR(totalIncl), {
    bold: true,
    size: 11,
    color: BRAND_RGB,
  });

  if (invoice.paidAt) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(22, 163, 74);
    doc.text(`Paid on ${fmtDate(invoice.paidAt)}`, valueX, y, { align: 'right' });
    y += 6;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const noteSections: string[] = [];
  if (invoice.notes?.trim()) noteSections.push(invoice.notes.trim());
  if (invoice.paymentReference) {
    noteSections.push(`Payment reference: ${invoice.paymentReference}`);
  }
  if (invoice.bankDetailsNote?.trim()) {
    noteSections.push(invoice.bankDetailsNote.trim());
  }

  if (noteSections.length > 0) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK_RGB);
    doc.text('Notes', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED_RGB);
    for (const section of noteSections) {
      const noteLines = doc.splitTextToSize(section, CONTENT_W) as string[];
      doc.text(noteLines, MARGIN, y);
      y += noteLines.length * 4.2 + 3;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const FOOTER_Y = 285;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, FOOTER_Y, RIGHT, FOOTER_Y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(practiceName, MARGIN, FOOTER_Y + 4);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-ZA')}`,
    RIGHT,
    FOOTER_Y + 4,
    { align: 'right' }
  );

  doc.save(`${invoice.invoiceNumber}.pdf`);
}
