import jsPDF from 'jspdf';
import {
  hasPdfFieldContent,
  visiblePdfFields,
  type PdfFieldRow,
} from '../lib/practicePatientRecordPdfFormat';
import type { DjangoPracticePatient } from './djangoApiService';
import { fetchPracticeLogoDataUrl } from './invoicePdfService';

const BRAND: [number, number, number] = [26, 77, 77];
const MUTED: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [30, 41, 59];
const PANEL_FILL: [number, number, number] = [248, 250, 249];
const PANEL_BORDER: [number, number, number] = [223, 230, 225];

export type PracticePatientRecordPdfInput = {
  patient: DjangoPracticePatient;
  practiceName: string;
  practiceTradingName?: string;
  practiceLogoUrl?: string;
  practiceAddress?: string;
  practiceBhf?: string;
  clinicCode?: string;
  assignedDoctorName?: string;
};

type PdfField = PdfFieldRow;

type PdfSection = { title: string; fields: PdfField[] };

function dash(value: string | undefined | null): string {
  const trimmed = (value ?? '').trim();
  return trimmed || '—';
}

function formatList(value?: string[] | string | null): string {
  if (Array.isArray(value)) {
    const joined = value.map((item) => item.trim()).filter(Boolean).join(', ');
    return joined || '—';
  }
  return dash(value);
}

function formatDate(value?: string | null): string {
  if (!value?.trim()) return '—';
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatGender(value?: string): string {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return '—';
  if (raw === 'female') return 'Female';
  if (raw === 'male') return 'Male';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatEncounters(
  rows?: Array<{ number?: string; date?: string; type?: string }>,
): string {
  if (!rows?.length) return '—';
  return rows
    .map((row) =>
      [row.date, row.type, row.number ? `#${row.number}` : ''].filter(Boolean).join(' · '),
    )
    .join('\n');
}

function formatWeight(value?: string): string {
  if (!value?.trim()) return '—';
  return /kg|lb/i.test(value) ? value.trim() : `${value.trim()} kg`;
}

function sectionHasContent(fields: PdfField[]): boolean {
  return fields.some((field) => hasPdfFieldContent(field.value));
}

function buildSections(input: PracticePatientRecordPdfInput): PdfSection[] {
  const p = input.patient;
  const caregiver = p.hasCaregiver
    ? ['Yes', p.caregiverEmail].filter(Boolean).join(' · ')
    : p.caregiverEmail || '';

  const identity: PdfField[] = [
    { label: 'Full name', value: dash(p.displayName) },
    { label: 'Date of birth', value: formatDate(p.dateOfBirth) },
    { label: 'Gender', value: formatGender(p.gender) },
    { label: 'National ID / member ID', value: dash(p.idNumber) },
    { label: 'UniCharts chart ID (S.S.N.)', value: dash(p.chartId) },
    { label: 'MRN', value: dash(p.mrn) },
    { label: 'Age (from chart)', value: dash(p.unichartAge) },
    { label: 'Race', value: dash(p.race) },
  ];

  const contact: PdfField[] = [
    { label: 'Email', value: dash(p.email) },
    { label: 'Cell / primary phone', value: dash(p.phoneNumber) },
    { label: 'Home phone', value: dash(p.homePhone) },
    { label: 'Work phone', value: dash(p.workPhone) },
    { label: 'Emergency contact name', value: dash(p.emergencyContactName) },
    { label: 'Emergency contact phone', value: dash(p.emergencyContactPhone) },
    { label: 'Role / contact status', value: dash(p.contactStatus) },
    { label: 'Institution', value: dash(p.institution) },
    { label: 'Address', value: dash(p.address), fullWidth: true },
  ];

  const medicalAid: PdfField[] = [
    { label: 'Scheme', value: dash(p.medicalAidName) },
    { label: 'Membership number', value: dash(p.medicalAidNumber) },
    { label: 'Group number', value: dash(p.medicalAidGroup) },
    { label: 'Plan option', value: dash(p.planOption) },
    { label: 'Relationship to insured', value: dash(p.insuredRelationship) },
    { label: 'Authorization number', value: dash(p.medicalAidAuthNumber) },
  ];

  const guarantor: PdfField[] = [
    { label: 'Guarantor name', value: dash(p.guarantorName) },
    { label: 'Guarantor phone', value: dash(p.guarantorPhone) },
    { label: 'Relationship to guarantor', value: dash(p.guarantorRelationship) },
    { label: 'Guarantor remarks', value: dash(p.guarantorRemarks), fullWidth: true },
  ];

  const clinical: PdfField[] = [
    { label: 'Past medical history', value: dash(p.pastMedicalHistoryText), fullWidth: true },
    { label: 'Family history', value: dash(p.familyHistoryText), fullWidth: true },
    { label: 'Social history', value: dash(p.socialHistoryText), fullWidth: true },
    { label: 'Master problems list', value: formatList(p.masterProblemsList), fullWidth: true },
    { label: 'Active problems', value: formatList(p.activeProblems), fullWidth: true },
    {
      label: 'Recent encounters',
      value: formatEncounters(p.recentUnichartEncounters),
      fullWidth: true,
    },
    { label: 'Language', value: dash(p.language) },
    { label: 'Marital status', value: dash(p.maritalStatus) },
    { label: 'Occupation', value: dash(p.occupation) },
    { label: 'Employment status', value: dash(p.employmentStatus) },
    { label: 'Blood group', value: dash(p.bloodGroup) },
    { label: 'Weight', value: formatWeight(p.weight) },
    { label: 'Allergies', value: formatList(p.allergies), fullWidth: true },
    { label: 'Conditions', value: formatList(p.previousHealthConditions), fullWidth: true },
    { label: 'Previous surgeries', value: formatList(p.previousSurgeries), fullWidth: true },
    { label: 'Previous medications', value: formatList(p.previousMedications), fullWidth: true },
    { label: 'Preferred hospital', value: dash(p.preferredHospital) },
    { label: 'Caregiver', value: dash(caregiver) },
  ];

  const careTeam: PdfField[] = [
    { label: 'Assigned doctor', value: dash(input.assignedDoctorName) },
    {
      label: 'Account status',
      value: p.status === 'active' ? 'Activated' : 'Pending activation',
    },
    {
      label: 'Can sign in',
      value: p.isActive === false ? 'No' : 'Yes',
    },
    { label: 'Clinic code', value: dash(input.clinicCode || p.clinicCode) },
  ];

  const sections: PdfSection[] = [
    { title: 'Identity', fields: visiblePdfFields(identity) },
    { title: 'Contact', fields: visiblePdfFields(contact) },
  ];

  if (sectionHasContent(medicalAid)) {
    sections.push({ title: 'Medical aid', fields: visiblePdfFields(medicalAid) });
  }
  if (sectionHasContent(guarantor)) {
    sections.push({ title: 'Guarantor (UniCharts)', fields: visiblePdfFields(guarantor) });
  }
  if (sectionHasContent(clinical)) {
    sections.push({
      title: 'UniCharts clinical record',
      fields: visiblePdfFields(clinical),
    });
  }
  sections.push({ title: 'Care team & account', fields: visiblePdfFields(careTeam, { keepEmpty: true }) });

  return sections.filter((section) => section.fields.length > 0);
}

export function practicePatientRecordFileName(displayName?: string): string {
  const base = (displayName || 'patient')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `patient-record-${base || 'export'}.pdf`;
}

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed <= pageHeight(doc) - margin) {
    return y;
  }
  doc.addPage();
  return margin;
}

function measureFieldHeight(doc: jsPDF, field: PdfField, width: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(field.value, width) as string[];
  return 5 + Math.max(lines.length, 1) * 4.2 + 3;
}

function drawFieldCell(
  doc: jsPDF,
  field: PdfField,
  x: number,
  y: number,
  width: number,
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(field.label.toUpperCase(), x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(field.value, width) as string[];
  let cy = y + 4.5;
  for (const line of lines) {
    doc.text(line, x, cy);
    cy += 4.2;
  }
  return cy - y + 2;
}

function shouldUseFullWidth(field: PdfField, colWidth: number, doc: jsPDF): boolean {
  if (field.fullWidth) return true;
  if (field.value.includes('\n')) return true;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  return doc.getTextWidth(field.value) > colWidth - 2;
}

function drawSectionPanel(
  doc: jsPDF,
  section: PdfSection,
  startY: number,
  margin: number,
  contentWidth: number,
): number {
  const padding = 5;
  const colGap = 6;
  const colWidth = (contentWidth - padding * 2 - colGap) / 2;
  const titleH = 10;
  const fields = section.fields;

  let contentH = padding + titleH;
  let index = 0;
  while (index < fields.length) {
    const field = fields[index]!;
    if (shouldUseFullWidth(field, colWidth, doc)) {
      contentH += measureFieldHeight(doc, field, contentWidth - padding * 2) + 2;
      index += 1;
      continue;
    }
    const right = fields[index + 1];
    const leftH = measureFieldHeight(doc, field, colWidth);
    const rightH =
      right && !shouldUseFullWidth(right, colWidth, doc)
        ? measureFieldHeight(doc, right, colWidth)
        : 0;
    contentH += Math.max(leftH, rightH) + 2;
    index += right && !shouldUseFullWidth(right, colWidth, doc) ? 2 : 1;
  }
  contentH += padding;

  let y = ensureSpace(doc, startY, contentH + 4, margin);

  doc.setFillColor(...PANEL_FILL);
  doc.setDrawColor(...PANEL_BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, contentWidth, contentH, 2, 2, 'FD');

  let cursor = y + padding + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(section.title.toUpperCase(), margin + padding, cursor);
  cursor += titleH - 2;

  index = 0;
  while (index < fields.length) {
    const field = fields[index]!;
    const leftX = margin + padding;
    const rightX = margin + padding + colWidth + colGap;

    if (shouldUseFullWidth(field, colWidth, doc)) {
      cursor = ensureSpace(doc, cursor, measureFieldHeight(doc, field, contentWidth - padding * 2), margin);
      const h = drawFieldCell(doc, field, leftX, cursor, contentWidth - padding * 2);
      cursor += h + 2;
      index += 1;
      continue;
    }

    const right = fields[index + 1];
    const pairRight =
      right && !shouldUseFullWidth(right, colWidth, doc) ? right : undefined;
    const leftH = drawFieldCell(doc, field, leftX, cursor, colWidth);
    const rightH = pairRight
      ? drawFieldCell(doc, pairRight, rightX, cursor, colWidth)
      : 0;
    cursor += Math.max(leftH, rightH) + 2;
    index += pairRight ? 2 : 1;
  }

  return y + contentH + 6;
}

function fitLogoBox(naturalW: number, naturalH: number, maxW: number, maxH: number) {
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

async function drawLetterhead(
  doc: jsPDF,
  input: PracticePatientRecordPdfInput,
  layout: { margin: number; right: number; contentWidth: number },
): Promise<number> {
  const { margin, right, contentWidth } = layout;
  const practiceName = (input.practiceTradingName || input.practiceName).trim() || 'Clinic';
  const logoDataUrl = input.practiceLogoUrl
    ? await fetchPracticeLogoDataUrl(undefined, input.practiceLogoUrl, {
        skipDoctorLogoStore: true,
      })
    : undefined;

  let headerBottom = margin;
  let textLeft = margin;
  let logoDrawn = false;
  const LOGO_MAX_W = 44;
  const LOGO_MAX_H = 28;

  if (logoDataUrl) {
    try {
      const img = new Image();
      img.src = logoDataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('logo decode failed'));
      });
      const box = fitLogoBox(img.naturalWidth, img.naturalHeight, LOGO_MAX_W, LOGO_MAX_H);
      const format = logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoDataUrl, format, margin, margin, box.w, box.h);
      headerBottom = Math.max(headerBottom, margin + box.h);
      textLeft = margin + box.w + 5;
      logoDrawn = true;
    } catch {
      // continue without logo
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(logoDrawn ? 12 : 14);
  doc.setTextColor(...BRAND);
  doc.text(practiceName, logoDrawn ? textLeft : margin, margin + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const metaLines = [
    input.practiceBhf ? `BHF: ${input.practiceBhf}` : '',
    input.practiceAddress ?? '',
  ].filter(Boolean);
  let ry = margin + 5;
  for (const line of metaLines) {
    for (const wrapped of doc.splitTextToSize(line, 72) as string[]) {
      doc.text(wrapped, right, ry, { align: 'right' });
      ry += 4;
    }
  }
  headerBottom = Math.max(headerBottom, ry, margin + LOGO_MAX_H) + 3;

  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(margin, headerBottom, right, headerBottom);

  let y = headerBottom + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND);
  doc.text('PATIENT RECORD', margin, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(dash(input.patient.displayName), margin, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const sublines = [
    `Warrior profile · ${practiceName}`,
    input.assignedDoctorName ? `Assigned clinician: ${input.assignedDoctorName}` : '',
    `Generated ${new Date().toLocaleString('en-ZA')}`,
  ].filter(Boolean);
  for (const line of sublines) {
    doc.text(line, margin, y);
    y += 4.2;
  }

  y += 4;
  doc.setDrawColor(...PANEL_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  return y + 8;
}

function drawFooters(doc: jsPDF, practiceName: string, margin: number, right: number): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    const footerY = pageHeight(doc) - 10;
    doc.setDrawColor(...PANEL_BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, right, footerY - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${practiceName} · Anixi Health`, margin, footerY);
    doc.text(
      `Confidential · Page ${page} of ${total}`,
      right,
      footerY,
      { align: 'right' },
    );
  }
}

export async function generatePracticePatientRecordPDF(
  input: PracticePatientRecordPdfInput,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 16;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const RIGHT = PAGE_W - MARGIN;
  const practiceName = (input.practiceTradingName || input.practiceName).trim() || 'Clinic';

  let y = await drawLetterhead(doc, input, {
    margin: MARGIN,
    right: RIGHT,
    contentWidth: CONTENT_W,
  });

  for (const section of buildSections(input)) {
    y = drawSectionPanel(doc, section, y, MARGIN, CONTENT_W);
  }

  drawFooters(doc, practiceName, MARGIN, RIGHT);
  doc.save(practicePatientRecordFileName(input.patient.displayName));
}

export async function downloadPracticePatientRecordPDF(options: {
  patient: DjangoPracticePatient;
  practice: {
    name: string;
    tradingName?: string;
    logoUrl?: string;
    bhfPracticeNumber?: string;
    clinicCode?: string;
    locations?: Array<{ address?: string }>;
  };
  assignedDoctorName?: string;
}): Promise<void> {
  await generatePracticePatientRecordPDF({
    patient: options.patient,
    practiceName: options.practice.name,
    practiceTradingName: options.practice.tradingName,
    practiceLogoUrl: options.practice.logoUrl,
    practiceAddress: options.practice.locations?.[0]?.address,
    practiceBhf: options.practice.bhfPracticeNumber,
    clinicCode: options.practice.clinicCode,
    assignedDoctorName: options.assignedDoctorName,
  });
}
