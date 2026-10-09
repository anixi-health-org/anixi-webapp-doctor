import jsPDF from 'jspdf';
import { buildInvoiceLetterhead, type DoctorLetterheadData } from '../lib/invoiceLetterhead';
import { renderSaClinicPrescriptionPdf } from '../lib/saClinicDocumentPdf';
import type { Doctor, Practice } from '../types';
import { fetchPracticeLogoDataUrl } from './invoicePdfService';

export type BuildPrescriptionPdfParams = {
  doctor: Doctor | null;
  practice?: Practice | null;
  patientName: string;
  appointmentDateLabel: string;
  content: string;
  icd10Code?: string;
  nappiCode?: string;
  medicalAidName?: string;
  medicalAidNumber?: string;
};

function fileSafePatient(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function buildPrescriptionPdfDocument(
  params: BuildPrescriptionPdfParams,
): Promise<{ doc: jsPDF; fileName: string; letterhead: DoctorLetterheadData }> {
  const letterhead = buildInvoiceLetterhead({
    doctor: params.doctor ?? undefined,
    practice: params.practice ?? undefined,
    treatingClinicianName: params.doctor?.displayName,
  });

  const logoDataUrl = await fetchPracticeLogoDataUrl(
    letterhead.brandingSource === 'practice' ? undefined : params.doctor?.id,
    letterhead.logoUrl,
    { skipDoctorLogoStore: letterhead.brandingSource === 'practice' },
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  if (logoDataUrl) {
    try {
      const format = logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoDataUrl, format, margin, margin, 40, 22);
    } catch {
      // letterhead text still renders
    }
  }

  renderSaClinicPrescriptionPdf(
    doc,
    {
      letterhead: { ...letterhead, logoDataUrl },
      patientName: params.patientName,
      appointmentDateLabel: params.appointmentDateLabel,
      prescriberName: params.doctor?.displayName || 'Clinician',
      content: params.content,
      icd10Code: params.icd10Code,
      nappiCode: params.nappiCode,
      medicalAidName: params.medicalAidName,
      medicalAidNumber: params.medicalAidNumber,
    },
    { margin: logoDataUrl ? margin + 26 : margin, pageWidth, pageHeight, contentWidth },
  );

  const fileName = `prescription-${fileSafePatient(params.patientName || 'patient')}-${new Date().toISOString().split('T')[0]}.pdf`;
  return { doc, fileName, letterhead };
}

export async function downloadPrescriptionPdf(params: BuildPrescriptionPdfParams): Promise<void> {
  const { doc, fileName } = await buildPrescriptionPdfDocument(params);
  doc.save(fileName);
}
