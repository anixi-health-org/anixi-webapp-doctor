import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useAuth } from '../hooks/useAuth';
import { getAppointmentById } from '../services/appointmentService';
import { Appointment, PostConsultAction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DetailPageSkeleton } from '../components/ui';

const findDraft = (
  actions: PostConsultAction[] | undefined,
  type: 'prescription_draft' | 'doctor_letter_draft'
): PostConsultAction | undefined =>
  actions?.find((action) => action.type === type);

const PrintDocumentsPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !appointmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const apt = await getAppointmentById(user.id, appointmentId);
      if (!apt) {
        setError('Appointment not found.');
        return;
      }
      setAppointment(apt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const prescriptionDraft = findDraft(appointment?.postConsultActions, 'prescription_draft');
  const letterDraft = findDraft(appointment?.postConsultActions, 'doctor_letter_draft');

  const createPdfDocument = (
    title: string,
    draft: PostConsultAction | undefined,
    filePrefix: string
  ) => {
    const content = draft?.content || '';
    const metaNappi =
      draft?.metadata && typeof draft.metadata.nappiCode === 'string'
        ? draft.metadata.nappiCode
        : '';
    const metaIcd =
      draft?.metadata && typeof draft.metadata.icd10Code === 'string'
        ? draft.metadata.icd10Code
        : '';

    const appointmentDate = appointment?.date
      ? new Date(appointment.date).toLocaleDateString('en-ZA', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : 'N/A';

    const fileSafePatient = (appointment?.patientName || 'patient')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(title, margin, cursorY);

    cursorY += 28;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(`Doctor: ${user?.displayName || 'Doctor'}`, margin, cursorY);
    cursorY += 16;
    pdf.text(`Patient: ${appointment?.patientName || 'Patient'}`, margin, cursorY);
    cursorY += 16;
    pdf.text(`Appointment: ${appointmentDate}`, margin, cursorY);
    if (metaNappi) {
      cursorY += 16;
      pdf.text(`NAPPI: ${metaNappi}`, margin, cursorY);
    }
    if (metaIcd) {
      cursorY += 16;
      pdf.text(`ICD-10: ${metaIcd}`, margin, cursorY);
    }

    cursorY += 24;
    pdf.setDrawColor(220, 220, 220);
    pdf.roundedRect(margin, cursorY, contentWidth, pageHeight - cursorY - margin, 8, 8);

    cursorY += 24;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);

    const normalizedContent =
      content.trim().length > 0 ? content.trim() : `No ${title.toLowerCase()} content available.`;
    const paragraphs = normalizedContent.split(/\n+/);

    for (const paragraph of paragraphs) {
      const lines = pdf.splitTextToSize(paragraph || ' ', contentWidth - 28) as string[];
      for (const line of lines) {
        if (cursorY > pageHeight - margin - 14) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.text(line, margin + 14, cursorY);
        cursorY += 16;
      }
      cursorY += 6;
    }

    return {
      doc: pdf,
      fileName: `${filePrefix}-${fileSafePatient || 'patient'}-${new Date().toISOString().split('T')[0]}.pdf`,
    };
  };

  const downloadPrescription = () => {
    if (!prescriptionDraft?.content?.trim()) return;
    const { doc, fileName } = createPdfDocument('Prescription', prescriptionDraft, 'prescription');
    doc.save(fileName);
  };

  const downloadLetter = () => {
    if (!letterDraft?.content?.trim()) return;
    const { doc, fileName } = createPdfDocument('Doctor Letter', letterDraft, 'doctor-letter');
    doc.save(fileName);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-red-600">{error || 'Appointment not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/appointments')}
          className="mt-4 rounded-lg border px-4 py-2 text-sm"
        >
          Back to appointments
        </button>
      </div>
    );
  }

  const dateLabel = appointment.date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-2xl mx-auto p-6 print:p-0">
      <div className="mb-4 print:hidden">
        <button
          type="button"
          onClick={() => navigate(`/appointments/${appointment.id}`)}
          className="text-sm text-anixi-green hover:underline"
        >
          Back to appointment
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-1 print:text-xl">Print documents</h1>
      <p className="text-sm text-gray-600 mb-6">
        {appointment.patientName} · {dateLabel}
        {appointment.time ? ` · ${appointment.time}` : ''}
      </p>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Available documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="mb-4 space-y-2 text-sm text-gray-600">
            <li>
              Prescription draft:{' '}
              {prescriptionDraft?.content?.trim() ? 'Ready' : 'Not saved yet'}
            </li>
            <li>
              Doctor letter draft:{' '}
              {letterDraft?.content?.trim() ? 'Ready' : 'Not saved yet'}
            </li>
          </ul>

          <div className="space-y-3 print:hidden">
            <button
              type="button"
              disabled={!prescriptionDraft?.content?.trim()}
              onClick={downloadPrescription}
              className="w-full px-4 py-3 rounded-lg border text-left disabled:opacity-50 hover:border-anixi-green/40"
            >
              Download prescription PDF
            </button>
            <button
              type="button"
              disabled={!letterDraft?.content?.trim()}
              onClick={downloadLetter}
              className="w-full px-4 py-3 rounded-lg border text-left disabled:opacity-50 hover:border-anixi-green/40"
            >
              Download letter PDF
            </button>
            <button
              type="button"
              onClick={() => navigate(`/invoices/new/${appointment.id}`)}
              className="w-full px-4 py-3 rounded-lg border text-left hover:border-anixi-green/40"
            >
              Open invoice create
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full px-4 py-3 rounded-lg border text-left hover:border-anixi-green/40"
            >
              Print page
            </button>
            <button
              type="button"
              onClick={() => navigate(`/appointments/${appointment.id}/post-consult`)}
              className="w-full px-4 py-3 rounded-lg border text-left hover:border-anixi-green/40"
            >
              Open post-consult workspace
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrintDocumentsPage;
