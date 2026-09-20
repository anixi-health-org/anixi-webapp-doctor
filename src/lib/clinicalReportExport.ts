import { jsPDF } from 'jspdf';
import {
  CLINICAL_REPORT_SECTIONS,
  clinicalReportFileName,
  type ClinicalReportSections,
} from './clinicalReportFormat';

export type ClinicalReportExportParams = {
  sections: ClinicalReportSections;
  patientName?: string;
  doctorName?: string;
  doctorLicense?: string;
  doctorBhf?: string;
  appointmentDate?: string;
  icd10Code?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headerLines(params: ClinicalReportExportParams): string[] {
  return [
    params.doctorName ? `Clinician: ${params.doctorName}` : null,
    params.doctorLicense ? `HPCSA: ${params.doctorLicense}` : null,
    params.doctorBhf ? `BHF: ${params.doctorBhf}` : null,
    params.patientName ? `Patient: ${params.patientName}` : null,
    params.appointmentDate ? `Visit date: ${params.appointmentDate}` : null,
    params.icd10Code ? `ICD-10: ${params.icd10Code}` : null,
  ].filter(Boolean) as string[];
}

export function buildClinicalReportPdf(params: ClinicalReportExportParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Consultation Report (History & Physical)', margin, cursorY);

  cursorY += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  for (const line of headerLines(params)) {
    doc.text(line, margin, cursorY);
    cursorY += 14;
  }

  cursorY += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 18;

  for (const section of CLINICAL_REPORT_SECTIONS) {
    const body = params.sections[section.id]?.trim();
    if (!body) continue;

    if (cursorY > pageHeight - margin - 40) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(section.title, margin, cursorY);
    cursorY += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body, contentWidth) as string[];
    for (const line of lines) {
      if (cursorY > pageHeight - margin - 14) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += 14;
    }
    cursorY += 10;
  }

  return {
    doc,
    fileName: clinicalReportFileName(params.patientName, 'pdf'),
  };
}

export function createClinicalReportPdfBlobUrl(params: ClinicalReportExportParams): string {
  const { doc } = buildClinicalReportPdf(params);
  return URL.createObjectURL(doc.output('blob'));
}

function buildClinicalReportWordHtml(params: ClinicalReportExportParams): string {
  const headerHtml = headerLines(params)
    .map((line) => `<p style="margin:0 0 6pt 0;font-size:11pt;">${escapeHtml(line)}</p>`)
    .join('');

  const sectionHtml = CLINICAL_REPORT_SECTIONS.map((section) => {
    const body = params.sections[section.id]?.trim();
    if (!body) return '';

    const paragraphs = body
      .split('\n')
      .map((line) => `<p style="margin:0 0 6pt 0;font-size:11pt;">${escapeHtml(line.trim() || ' ')}</p>`)
      .join('');

    return `<h2 style="font-size:12pt;margin:12pt 0 6pt 0;">${escapeHtml(section.title)}</h2>${paragraphs}`;
  }).join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Consultation Report</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
</head>
<body style="font-family:Calibri,Arial,sans-serif;color:#111827;">
  <h1 style="font-size:16pt;margin:0 0 12pt 0;">Consultation Report (History &amp; Physical)</h1>
  ${headerHtml}
  <hr style="border:none;border-top:1px solid #dcdcdc;margin:12pt 0;" />
  ${sectionHtml}
</body>
</html>`;
}

export async function buildClinicalReportDocx(
  params: ClinicalReportExportParams,
): Promise<{ blob: Blob; fileName: string }> {
  const html = buildClinicalReportWordHtml(params);
  const blob = new Blob(['\ufeff', html], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return {
    blob,
    fileName: clinicalReportFileName(params.patientName, 'docx'),
  };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadClinicalReportDocx(params: ClinicalReportExportParams): Promise<void> {
  const { blob, fileName } = await buildClinicalReportDocx(params);
  downloadBlob(blob, fileName);
}

export function downloadClinicalReportPdf(params: ClinicalReportExportParams): void {
  const { doc, fileName } = buildClinicalReportPdf(params);
  doc.save(fileName);
}
