import jsPDF from 'jspdf';
import type { DjangoPracticePatient } from './djangoApiService';

const BRAND_RGB: [number, number, number] = [66, 89, 80];
const MUTED_RGB: [number, number, number] = [100, 116, 139];
const INK_RGB: [number, number, number] = [30, 41, 59];

export type PracticePatientRecordPdfInput = {
  patient: DjangoPracticePatient;
  practiceName: string;
  clinicCode?: string;
  assignedDoctorName?: string;
};

type PdfField = { label: string; value: string };

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
    .map((row) => [row.date, row.type, row.number ? `#${row.number}` : ''].filter(Boolean).join(' · '))
    .join('\n');
}

function formatWeight(value?: string): string {
  if (!value?.trim()) return '—';
  return /kg|lb/i.test(value) ? value.trim() : `${value.trim()} kg`;
}

function hasContent(value: string): boolean {
  return value.trim() !== '' && value.trim() !== '—';
}

function sectionHasContent(fields: PdfField[]): boolean {
  return fields.some((field) => hasContent(field.value));
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
    { label: 'Contact status', value: dash(p.contactStatus) },
    { label: 'Institution', value: dash(p.institution) },
    { label: 'Address', value: dash(p.address) },
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
    { label: 'Guarantor remarks', value: dash(p.guarantorRemarks) },
  ];

  const clinical: PdfField[] = [
    { label: 'Past medical history (narrative)', value: dash(p.pastMedicalHistoryText) },
    { label: 'Family history', value: dash(p.familyHistoryText) },
    { label: 'Social history', value: dash(p.socialHistoryText) },
    { label: 'Master problems list', value: formatList(p.masterProblemsList) },
    { label: 'Active problems', value: formatList(p.activeProblems) },
    { label: 'Recent encounters', value: formatEncounters(p.recentUnichartEncounters) },
    { label: 'Language', value: dash(p.language) },
    { label: 'Marital status', value: dash(p.maritalStatus) },
    { label: 'Occupation', value: dash(p.occupation) },
    { label: 'Employment status', value: dash(p.employmentStatus) },
    { label: 'Blood group', value: dash(p.bloodGroup) },
    { label: 'Weight', value: formatWeight(p.weight) },
    { label: 'Allergies', value: formatList(p.allergies) },
    { label: 'Conditions', value: formatList(p.previousHealthConditions) },
    { label: 'Previous surgeries', value: formatList(p.previousSurgeries) },
    { label: 'Previous medications', value: formatList(p.previousMedications) },
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
    { title: 'Identity', fields: identity },
    { title: 'Contact', fields: contact },
  ];

  if (sectionHasContent(medicalAid)) {
    sections.push({ title: 'Medical aid', fields: medicalAid });
  }
  if (sectionHasContent(guarantor)) {
    sections.push({ title: 'Guarantor (UniCharts)', fields: guarantor });
  }
  if (sectionHasContent(clinical)) {
    sections.push({ title: 'UniCharts clinical record', fields: clinical });
  }
  sections.push({ title: 'Care team', fields: careTeam });

  return sections;
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

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - margin) {
    return y;
  }
  doc.addPage();
  return margin;
}

function drawField(
  doc: jsPDF,
  field: PdfField,
  x: number,
  y: number,
  width: number,
  margin: number,
): number {
  let cursor = ensureSpace(doc, y, 28, margin);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(field.label.toUpperCase(), x, cursor);

  cursor += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK_RGB);
  const lines = doc.splitTextToSize(field.value, width) as string[];
  for (const line of lines) {
    cursor = ensureSpace(doc, cursor, 14, margin);
    doc.text(line, x, cursor);
    cursor += 12;
  }
  return cursor + 4;
}

export async function generatePracticePatientRecordPDF(
  input: PracticePatientRecordPdfInput,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 16;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const RIGHT = PAGE_W - MARGIN;

  const practiceName = input.practiceName.trim() || 'Clinic';
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_RGB);
  doc.text('Patient record', MARGIN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_RGB);
  y += 7;
  doc.text(practiceName, MARGIN, y);
  y += 5;
  doc.text(`Warrior: ${dash(input.patient.displayName)}`, MARGIN, y);
  y += 5;
  doc.text(`Generated ${new Date().toLocaleString('en-ZA')}`, MARGIN, y);

  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, RIGHT, y);
  y += 10;

  for (const section of buildSections(input)) {
    y = ensureSpace(doc, y, 24, MARGIN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_RGB);
    doc.text(section.title, MARGIN, y);
    y += 8;

    const rows =
      section.title === 'Identity' || section.title === 'Contact' || section.title === 'Care team'
        ? section.fields
        : section.fields.filter((field) => hasContent(field.value));

    for (const field of rows) {
      y = drawField(doc, field, MARGIN, y, CONTENT_W, MARGIN);
    }

    y += 4;
  }

  const FOOTER_Y = 287;
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, FOOTER_Y, RIGHT, FOOTER_Y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Anixi Health · POPIA-aware clinic record export', MARGIN, FOOTER_Y + 4);
  doc.text('Confidential — for clinical use only', RIGHT, FOOTER_Y + 4, { align: 'right' });

  doc.save(practicePatientRecordFileName(input.patient.displayName));
}

export async function downloadPracticePatientRecordPDF(options: {
  patient: DjangoPracticePatient;
  practice: { name: string; clinicCode?: string };
  assignedDoctorName?: string;
}): Promise<void> {
  await generatePracticePatientRecordPDF({
    patient: options.patient,
    practiceName: options.practice.name,
    clinicCode: options.practice.clinicCode,
    assignedDoctorName: options.assignedDoctorName,
  });
}
