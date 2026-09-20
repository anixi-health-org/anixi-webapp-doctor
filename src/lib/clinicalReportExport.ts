import { jsPDF } from 'jspdf';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
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

export async function buildClinicalReportDocx(
  params: ClinicalReportExportParams,
): Promise<{ blob: Blob; fileName: string }> {
  const children: Paragraph[] = [
    new Paragraph({
      text: 'Consultation Report (History & Physical)',
      heading: HeadingLevel.HEADING_1,
    }),
    ...headerLines(params).map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
        }),
    ),
    new Paragraph({ text: '' }),
  ];

  for (const section of CLINICAL_REPORT_SECTIONS) {
    const body = params.sections[section.id]?.trim();
    if (!body) continue;

    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
      }),
    );

    for (const line of body.split('\n')) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.trim() || ' ', size: 22 })],
        }),
      );
    }

    children.push(new Paragraph({ text: '' }));
  }

  const document = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(document);
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
