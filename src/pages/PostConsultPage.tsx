import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Download,
  Eye,
  Printer,
  Save,
  X,
} from 'lucide-react';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { Toast } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import {
  addAppointmentDocument,
  getAppointmentById,
  getDoctorAppointments,
  syncAppointmentStatus,
  updateAppointment,
} from '../services/appointmentService';
import { sendPatientDownloadInvite } from '../services/patientManagementService';
import { Appointment, AppointmentDocument, PostConsultAction, PostConsultActionType } from '../types';

type DocumentMode = 'scan' | 'upload';

interface LocationState {
  appointment?: Appointment;
}

const actionButtonClass =
  'w-full rounded-xl border border-border bg-card px-4 py-4 text-left text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PostConsultPage: React.FC = () => {
const { appointmentId } = useParams<{ appointmentId: string }>();
const location = useLocation();
const { navigateBack } = useNavigateWithFallback();
const navigate = useNavigate();
const { user } = useAuth();

  const [appointment, setAppointment] = useState<Appointment | null>(
    (location.state as LocationState | undefined)?.appointment ?? null
  );
  const [isLoading, setIsLoading] = useState(!appointment);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<BlobPart[]>([]);
  const [recordingMimeType, setRecordingMimeType] = useState<string>('audio/webm');
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('Session recording');
  const [documentMode] = useState<DocumentMode>('scan');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionDraft, setPrescriptionDraft] = useState('');
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [showDoctorLetterModal, setShowDoctorLetterModal] = useState(false);
  const [doctorLetterDraft, setDoctorLetterDraft] = useState('');
  const [isSavingDoctorLetter, setIsSavingDoctorLetter] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfType, setPreviewPdfType] = useState<'prescription' | 'doctor-letter' | 'manual-documents'>('prescription');

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  useEffect(() => {
    const loadAppointment = async () => {
      if (!user?.id || !appointmentId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const direct = await getAppointmentById(user.id, appointmentId);
        if (direct) {
          setAppointment(direct);
          setNoteValue(direct.notes || '');
          return;
        }

        const allAppointments = await getDoctorAppointments(user.id);
        const found = allAppointments.find((item) => item.id === appointmentId) || null;
        if (!found) {
          setError('Appointment not found.');
          return;
        }

        setAppointment(found);
        setNoteValue(found.notes || '');
      } catch {
        setError('Failed to load appointment for post consult actions.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointment();
  }, [appointmentId, user?.id]);

  useEffect(() => {
    return () => {
      if (documentPreview) {
        URL.revokeObjectURL(documentPreview);
      }
    };
  }, [documentPreview]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  const documents = useMemo<AppointmentDocument[]>(() => appointment?.documents ?? [], [appointment?.documents]);

  const latestPrescriptionDraft = useMemo(() => {
    const actions = appointment?.postConsultActions ?? [];
    return actions
      .filter((action) => action.type === 'prescription_draft' && action.content.trim().length > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }, [appointment?.postConsultActions]);

  useEffect(() => {
    if (latestPrescriptionDraft) {
      setPrescriptionDraft(latestPrescriptionDraft.content);
    }
  }, [latestPrescriptionDraft]);

  const closeDocumentModal = () => {
    setShowDocumentModal(false);
    setDocumentFile(null);
    setDocumentTitle('');
    if (documentPreview) {
      URL.revokeObjectURL(documentPreview);
      setDocumentPreview(null);
    }
  };

  const handleDocumentPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setDocumentFile(file);
    if (documentPreview) {
      URL.revokeObjectURL(documentPreview);
    }

    if (file.type.startsWith('image/')) {
      setDocumentPreview(URL.createObjectURL(file));
    } else {
      setDocumentPreview(null);
    }
  };

  const persistActions = async (
    nextActions: PostConsultAction[],
    updates?: Partial<Appointment>
  ) => {
    if (!appointment || !user?.id) return;

    const sanitize = (v: any): any => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (Array.isArray(v)) return v.map((item) => sanitize(item)).filter((x) => x !== undefined);
      if (typeof v === 'object') {
        const out: any = {};
        Object.keys(v).forEach((k) => {
          const val = sanitize(v[k]);
          if (val !== undefined) out[k] = val;
        });
        return out;
      }
      return v;
    };

    const safeUpdates = sanitize({ ...(updates || {}), postConsultActions: nextActions });

    await updateAppointment(user.id, appointment.id, safeUpdates as Partial<Appointment>);
    await syncAppointmentStatus(appointment.id);

    setAppointment((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(updates || {}),
        postConsultActions: nextActions,
        updatedAt: new Date(),
      };
    });
  };

  const appendPostConsultAction = async (
    type: PostConsultActionType,
    payload: { title?: string; content: string; metadata?: Record<string, string | number | boolean | null> }
  ) => {
    if (!appointment || !user?.id) return;

    const now = new Date();
    const newAction: PostConsultAction = {
      id: `${type}-${now.getTime()}`,
      type,
      title: payload.title,
      content: payload.content,
      status: 'draft',
      metadata: payload.metadata,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const currentActions = appointment.postConsultActions ?? [];
    const nextActions = [newAction, ...currentActions];
    await persistActions(nextActions);
  };

  const saveNote = async () => {
    if (!appointment || !user?.id) return;

    try {
      setIsSavingNote(true);
      const trimmedNote = noteValue.trim();

      const now = new Date();
      const noteAction: PostConsultAction = {
        id: `post_consult_note-${now.getTime()}`,
        type: 'post_consult_note',
        title: 'Consult note',
        content: trimmedNote,
        status: 'draft',
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      };

      const currentActions = appointment.postConsultActions ?? [];
      const nextActions = [noteAction, ...currentActions];

      await persistActions(nextActions, { notes: trimmedNote });
      setShowNoteModal(false);
      setToast({ visible: true, message: 'Note saved to appointment.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to save note.', type: 'error' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const startRecording = async () => {
    try {
      setRecordedChunks([]);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Test supported MIME types in order of preference
      // Order: Best codecs first, with Windows fallbacks
      const supportedTypes = [
        'audio/webm;codecs=opus',      // Chrome/Firefox (Best quality)
        'audio/webm',                   // Chrome/Firefox fallback
        'audio/ogg;codecs=opus',       // Firefox
        'audio/ogg',                    // Firefox fallback
        'audio/mp4',                    // Safari/Windows fallback
        'audio/wav',                    // Windows/Universal fallback
      ];
      
      let mimeType = '';
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      // Fallback to empty string if none supported (browser will use default)
      if (!mimeType) {
        console.warn('No MIME type supported by MediaRecorder, using browser default');
        mimeType = '';
      }
      
      setRecordingMimeType(mimeType || 'audio/webm');
      const options: any = mimeType ? { mimeType } : {};
      
      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      
      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          setRecordedChunks((prev) => [...prev, ev.data]);
        }
      };
      
      mr.addEventListener('stop', () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      });
      
      mr.start();
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      
      // Provide specific guidance based on error
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setToast({
          visible: true,
          message: '🔒 Microphone permission denied. Please allow microphone access in your browser settings.',
          type: 'error',
        });
      } else if (message.includes('NotFoundError') || message.includes('no audio input')) {
        setToast({
          visible: true,
          message: '🎙️ No microphone found. Please check your audio device.',
          type: 'error',
        });
      } else {
        setToast({ visible: true, message, type: 'error' });
      }
    }
  };

  // const stopAndUploadRecording = async () => {
  //   try {
  //     setIsUploadingRecording(true);
  //     setIsRecording(false);
  //     const mr = mediaRecorderRef.current;
  //     if (mr && mr.state !== 'inactive') {
  //       await new Promise<void>((resolve) => {
  //         const onStop = () => {
  //           mr.removeEventListener('stop', onStop);
  //           resolve();
  //         };
  //         mr.addEventListener('stop', onStop);
  //         mr.stop();
  //       });
  //     }

  //     if (recordedChunks.length === 0) {
  //       setToast({ visible: true, message: 'No audio recorded.', type: 'error' });
  //       setIsUploadingRecording(false);
  //       return;
  //     }

  //     const blob = new Blob(recordedChunks, { type: recordingMimeType || 'audio/webm' });
      
  //     // Determine file extension based on MIME type
  //     let fileExtension = 'webm';
  //     if (recordingMimeType.includes('ogg')) {
  //       fileExtension = 'ogg';
  //     } else if (recordingMimeType.includes('mp4')) {
  //       fileExtension = 'mp4';
  //     } else if (recordingMimeType.includes('wav')) {
  //       fileExtension = 'wav';
  //     } else if (recordingMimeType.includes('mpeg')) {
  //       fileExtension = 'mp3';
  //     }
      
  //     const filename = `${(appointment?.patientName || 'session').replace(/[^a-z0-9]+/gi, '_')}-${Date.now()}.${fileExtension}`;
  //     const file = new File([blob], filename, { type: blob.type });

  //     if (!appointment || !user?.id) {
  //       setToast({ visible: true, message: 'Appointment not loaded', type: 'error' });
  //       setIsUploadingRecording(false);
  //       return;
  //     }

  //     const saved = await addAppointmentDocument(appointment.doctorId, appointment.id, file, user.id, recordingTitle || undefined);

  //     const now = new Date();
  //     const newAction: PostConsultAction = {
  //       id: `session_recording-${now.getTime()}`,
  //       type: 'session_recording',
  //       title: recordingTitle || 'Session recording',
  //       content: `Audio recording saved: ${saved.fileName}`,
  //       status: 'finalized',
  //       metadata: {
  //         fileName: saved.fileName,
  //         downloadURL: saved.downloadURL,
  //       },
  //       createdBy: user.id,
  //       createdAt: now,
  //       updatedAt: now,
  //     };

  //     const currentActions = appointment.postConsultActions ?? [];
  //     const nextActions = [newAction, ...currentActions];
  //     const nextDocuments = [saved, ...(appointment.documents ?? [])];

  //     await persistActions(nextActions, { documents: nextDocuments });

  //     setToast({ visible: true, message: 'Recording saved to appointment.', type: 'success' });
  //     setShowRecorder(false);
  //     setRecordedChunks([]);
  //   } catch (err) {
  //     const message = err instanceof Error ? err.message : 'Failed to upload recording';
  //     setToast({ visible: true, message, type: 'error' });
  //   } finally {
  //     setIsUploadingRecording(false);
  //   }
  // };

  //     if (!appointment || !user?.id) {
  //       setToast({ visible: true, message: 'Appointment not loaded', type: 'error' });
  //       setIsUploadingRecording(false);
  //       return;
  //     }

  // //     const saved = await addAppointmentDocument(appointment.doctorId, appointment.id, file, user.id, recordingTitle || undefined);

  // //     const now = new Date();
  // //     const newAction: PostConsultAction = {
  // //       id: `session_recording-${now.getTime()}`,
  // //       type: 'session_recording',
  // //       title: recordingTitle || 'Session recording',
  // //       content: `Audio recording saved: ${saved.fileName}`,
  // //       status: 'finalized',
  // //       metadata: {
  // //         fileName: saved.fileName,
  // //         downloadURL: saved.downloadURL,
  // //       },
  // //       createdBy: user.id,
  // //       createdAt: now,
  // //       updatedAt: now,
  // //     };

  // //     const currentActions = appointment.postConsultActions ?? [];
  // //     const nextActions = [newAction, ...currentActions];
  // //     const nextDocuments = [saved, ...(appointment.documents ?? [])];

  // //     await persistActions(nextActions, { documents: nextDocuments });

  // //     setToast({ visible: true, message: 'Recording saved to appointment.', type: 'success' });
  // //     setShowRecorder(false);
  // //     setRecordedChunks([]);
  //   } catch (err) {
  //     const message = err instanceof Error ? err.message : 'Failed to upload recording';
  //     setToast({ visible: true, message, type: 'error' });
  //   } finally {
  //     setIsUploadingRecording(false);
  //   }
  // };

  const stopAndUploadRecording = async () => {
    try {
      setIsUploadingRecording(true);
      setIsRecording(false);
  
      const mr = mediaRecorderRef.current;
  
      if (mr && mr.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          const onStop = () => {
            mr.removeEventListener('stop', onStop);
            resolve();
          };
  
          mr.addEventListener('stop', onStop);
          mr.stop();
        });
      }
  
      if (recordedChunks.length === 0) {
        setToast({
          visible: true,
          message: 'No audio recorded.',
          type: 'error',
        });
        return;
      }
  
      const blob = new Blob(recordedChunks, {
        type: recordingMimeType || 'audio/webm',
      });
  
      let fileExtension = 'webm';
  
      if (recordingMimeType.includes('ogg')) {
        fileExtension = 'ogg';
      } else if (recordingMimeType.includes('mp4')) {
        fileExtension = 'mp4';
      } else if (recordingMimeType.includes('wav')) {
        fileExtension = 'wav';
      } else if (recordingMimeType.includes('mpeg')) {
        fileExtension = 'mp3';
      }
  
      const filename = `${
        (appointment?.patientName || 'session')
          .replace(/[^a-z0-9]+/gi, '_')
      }-${Date.now()}.${fileExtension}`;
  
      const file = new File([blob], filename, {
        type: blob.type,
      });
  
      if (!appointment || !user?.id) {
        setToast({
          visible: true,
          message: 'Appointment not loaded',
          type: 'error',
        });
        return;
      }
  
      const saved = await addAppointmentDocument(
        appointment.doctorId,
        appointment.id,
        file,
        user.id,
        recordingTitle || undefined
      );
  
      const now = new Date();
  
      const newAction: PostConsultAction = {
        id: `session_recording-${now.getTime()}`,
        type: 'session_recording',
        title: recordingTitle || 'Session recording',
        content: `Audio recording saved: ${saved.fileName}`,
        status: 'finalized',
        metadata: {
          fileName: saved.fileName,
          downloadURL: saved.downloadURL,
        },
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      };
  
      const currentActions = appointment.postConsultActions ?? [];
  
      const nextActions = [
        newAction,
        ...currentActions,
      ];
  
      const nextDocuments = [
        saved,
        ...(appointment.documents ?? []),
      ];
  
      await persistActions(nextActions, {
        documents: nextDocuments,
      });
  
      setToast({
        visible: true,
        message: 'Recording saved to appointment.',
        type: 'success',
      });
  
      setShowRecorder(false);
      setRecordedChunks([]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to upload recording';
  
      setToast({
        visible: true,
        message,
        type: 'error',
      });
    } finally {
      setIsUploadingRecording(false);
    }
  };

   const cancelRecording = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        mr.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    } catch {}
    setIsRecording(false);
    setRecordedChunks([]);
    setShowRecorder(false);
  };

  const savePrescriptionDraft = async () => {
    if (!prescriptionDraft.trim()) {
      setToast({ visible: true, message: 'Prescription cannot be empty.', type: 'error' });
      return;
    }

    try {
      setIsSavingPrescription(true);
      await appendPostConsultAction('prescription_draft', {
        title: 'Prescription draft',
        content: prescriptionDraft.trim(),
      });
      setToast({ visible: true, message: 'Prescription draft saved.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to save prescription draft.', type: 'error' });
    } finally {
      setIsSavingPrescription(false);
    }
  };

  const saveDoctorLetterDraft = async () => {
    if (!doctorLetterDraft.trim()) {
      setToast({ visible: true, message: 'Doctor letter cannot be empty.', type: 'error' });
      return;
    }

    try {
      setIsSavingDoctorLetter(true);
      await appendPostConsultAction('doctor_letter_draft', {
        title: 'Doctor letter draft',
        content: doctorLetterDraft.trim(),
      });
      setToast({ visible: true, message: 'Doctor letter draft saved.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to save doctor letter draft.', type: 'error' });
    } finally {
      setIsSavingDoctorLetter(false);
    }
  };

  const createPrescriptionPdfDocument = () => {
    const content = (prescriptionDraft || latestPrescriptionDraft?.content || '').trim();
    const appointmentDate = appointment?.date
      ? new Date(appointment.date).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : 'N/A';

    const fileSafePatient = (appointment?.patientName || 'patient')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

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
    doc.setFontSize(20);
    doc.text('Prescription', margin, cursorY);

    cursorY += 28;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Doctor: ${user?.displayName || 'Doctor'}`, margin, cursorY);
    cursorY += 16;
    doc.text(`Patient: ${appointment?.patientName || 'Patient'}`, margin, cursorY);
    cursorY += 16;
    doc.text(`Appointment: ${appointmentDate}`, margin, cursorY);

    cursorY += 24;
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, cursorY, contentWidth, pageHeight - cursorY - margin, 8, 8);

    cursorY += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Medication and Instructions', margin + 14, cursorY);

    cursorY += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const normalizedContent = content.length > 0 ? content : 'No prescription content available.';
    const paragraphs = normalizedContent.split(/\n+/);

    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph || ' ', contentWidth - 28) as string[];

      for (const line of lines) {
        if (cursorY > pageHeight - margin - 14) {
          doc.addPage();
          cursorY = margin;
        }
        doc.text(line, margin + 14, cursorY);
        cursorY += 16;
      }

      cursorY += 6;
    }

    return {
      doc,
      fileName: `prescription-${fileSafePatient || 'patient'}-${new Date().toISOString().split('T')[0]}.pdf`,
    };
  };

  const buildPrescriptionPdf = () => {
    const { doc, fileName } = createPrescriptionPdfDocument();
    doc.save(fileName);
  };

  const createPrescriptionPdfBlobUrl = () => {
    const { doc } = createPrescriptionPdfDocument();
    const pdfBlob = doc.output('blob');
    return URL.createObjectURL(pdfBlob);
  };

  const createDoctorLetterPdfDocument = () => {
    const content = doctorLetterDraft.trim();
    const appointmentDate = appointment?.date
      ? new Date(appointment.date).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : 'N/A';

    const fileSafePatient = (appointment?.patientName || 'patient')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

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
    doc.setFontSize(20);
    doc.text('Doctor Letter', margin, cursorY);

    cursorY += 28;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Doctor: ${user?.displayName || 'Doctor'}`, margin, cursorY);
    cursorY += 16;
    doc.text(`Patient: ${appointment?.patientName || 'Patient'}`, margin, cursorY);
    cursorY += 16;
    doc.text(`Appointment: ${appointmentDate}`, margin, cursorY);

    cursorY += 24;
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, cursorY, contentWidth, pageHeight - cursorY - margin, 8, 8);

    cursorY += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const normalizedContent = content.length > 0 ? content : 'No doctor letter content available.';
    const paragraphs = normalizedContent.split(/\n+/);

    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph || ' ', contentWidth - 28) as string[];

      for (const line of lines) {
        if (cursorY > pageHeight - margin - 14) {
          doc.addPage();
          cursorY = margin;
        }
        doc.text(line, margin + 14, cursorY);
        cursorY += 16;
      }

      cursorY += 6;
    }

    return {
      doc,
      fileName: `doctor-letter-${fileSafePatient || 'patient'}-${new Date().toISOString().split('T')[0]}.pdf`,
    };
  };

  const buildDoctorLetterPdf = () => {
    const { doc, fileName } = createDoctorLetterPdfDocument();
    doc.save(fileName);
  };

  const createDoctorLetterPdfBlobUrl = () => {
    const { doc } = createDoctorLetterPdfDocument();
    const pdfBlob = doc.output('blob');
    return URL.createObjectURL(pdfBlob);
  };

  const createManualDocumentsPdfBlobUrl = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    let cursorY = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Manual Patient Documents', 48, cursorY);

    cursorY += 26;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Patient: ${appointment?.patientName || 'Patient'}`, 48, cursorY);
    cursorY += 16;
    doc.text(`Printed on: ${new Date().toLocaleString()}`, 48, cursorY);

    cursorY += 24;
    if (documents.length === 0) {
      doc.text('No uploaded documents were found for this manual patient.', 48, cursorY);
    } else {
      doc.text('Available documents:', 48, cursorY);
      cursorY += 18;
      documents.forEach((item, index) => {
        const line = `${index + 1}. ${item.title || item.fileName} (${formatFileSize(item.fileSize)})`;
        doc.text(line, 60, cursorY);
        cursorY += 16;
        if (cursorY > 760) {
          doc.addPage();
          cursorY = 60;
        }
      });
    }

    return URL.createObjectURL(doc.output('blob'));
  };

  const openPdfPreview = (blobUrl: string, type: 'prescription' | 'doctor-letter' | 'manual-documents') => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
    }
    setPreviewPdfUrl(blobUrl);
    setPreviewPdfType(type);
    setShowPreviewModal(true);
  };

  const openPrescriptionWindow = (printMode: boolean) => {
    try {
      const blobUrl = createPrescriptionPdfBlobUrl();
      openPdfPreview(blobUrl, 'prescription');

      if (printMode) {
        const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer,width=860,height=700');
        if (!printWindow) {
          setToast({ visible: true, message: 'Preview opened in-app. Use Print in viewer.', type: 'success' });
          return;
        }
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 450);
      }
    } catch {
      setToast({ visible: true, message: 'Failed to generate prescription PDF.', type: 'error' });
    }
  };

  const previewDoctorLetter = () => {
    if (!doctorLetterDraft.trim()) {
      setToast({ visible: true, message: 'Save or add a doctor letter first.', type: 'error' });
      return;
    }

    try {
      const blobUrl = createDoctorLetterPdfBlobUrl();
      openPdfPreview(blobUrl, 'doctor-letter');
    } catch {
      setToast({ visible: true, message: 'Failed to generate doctor letter PDF.', type: 'error' });
    }
  };

  const exportDoctorLetter = () => {
    if (!doctorLetterDraft.trim()) {
      setToast({ visible: true, message: 'Save or add a doctor letter first.', type: 'error' });
      return;
    }

    try {
      buildDoctorLetterPdf();
      setToast({ visible: true, message: 'Doctor letter exported successfully.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to export doctor letter PDF.', type: 'error' });
    }
  };

  const printPreviewPdf = () => {
    if (!previewPdfUrl) {
      setToast({ visible: true, message: 'Generate preview first.', type: 'error' });
      return;
    }

    const printWindow = window.open(previewPdfUrl, '_blank', 'noopener,noreferrer,width=860,height=700');
    if (!printWindow) {
      setToast({ visible: true, message: 'Popup blocked. Please allow popups for printing.', type: 'error' });
      return;
    }

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 450);
  };

  const handleManualPrintDocuments = () => {
    if (documents.length > 0 && documents[0].downloadURL) {
      const printWindow = window.open(
        documents[0].downloadURL,
        '_blank',
        'noopener,noreferrer,width=860,height=700'
      );
      if (!printWindow) {
        setToast({ visible: true, message: 'Popup blocked. Please allow popups for printing.', type: 'error' });
        return;
      }
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 450);
      return;
    }

    const blobUrl = createManualDocumentsPdfBlobUrl();
    openPdfPreview(blobUrl, 'manual-documents');
    setToast({ visible: true, message: 'Opened local print preview.', type: 'success' });
  };

  const handlePreviewExport = () => {
    if (previewPdfType === 'doctor-letter') {
      exportDoctorLetter();
      closePreviewModal();
      return;
    }

    if (previewPdfType === 'manual-documents') {
      const blobUrl = createManualDocumentsPdfBlobUrl();
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `manual-documents-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      setToast({ visible: true, message: 'Manual documents PDF exported.', type: 'success' });
      closePreviewModal();
      return;
    }

    exportPrescription();
    closePreviewModal();
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  };

  const previewPrescription = () => {
    if (!prescriptionDraft.trim() && !latestPrescriptionDraft?.content) {
      setToast({ visible: true, message: 'Save or add a prescription first.', type: 'error' });
      return;
    }
    openPrescriptionWindow(false);
  };

  const exportPrescription = () => {
    if (!prescriptionDraft.trim() && !latestPrescriptionDraft?.content) {
      setToast({ visible: true, message: 'Save or add a prescription first.', type: 'error' });
      return;
    }
    try {
      buildPrescriptionPdf();
      setToast({ visible: true, message: 'PDF exported successfully.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to export PDF.', type: 'error' });
    }
  };

  const saveDocument = async () => {
    if (!appointment || !documentFile || !user?.id) return;

    try {
      setIsSavingDocument(true);
      const saved = await addAppointmentDocument(
        appointment.doctorId,
        appointment.id,
        documentFile,
        user.id,
        documentTitle
      );

      const nextDocuments = [saved, ...(appointment.documents ?? [])];
      const nextActions = [
        {
          id: `medical_document-${Date.now()}`,
          type: 'medical_document' as const,
          title: documentTitle || saved.title || saved.fileName,
          content: `Uploaded ${saved.fileName}`,
          status: 'finalized' as const,
          createdBy: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            fileName: saved.fileName,
            fileType: saved.fileType,
          },
        },
        ...(appointment.postConsultActions ?? []),
      ];

      await persistActions(nextActions, { documents: nextDocuments });
      closeDocumentModal();
      setToast({ visible: true, message: 'Document saved to record.', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save document';
      setToast({ visible: true, message, type: 'error' });
    } finally {
      setIsSavingDocument(false);
    }
  };

  const actionConfig = [
    {
      key: 'internal',
      label: 'Internal',
      icon: '📝',
      enabled: true,
      onClick: () => setShowNoteModal(true),
    },
    {
      key: 'invite',
      label: 'Invite to',
      icon: '📧',
      enabled: true,
      onClick: async () => {
        if (!user?.id) return;
        const email = appointment?.patientEmail?.trim();
        if (!email) {
          setToast({
            visible: true,
            message: 'Add a patient email on this appointment before sending an invite.',
            type: 'error',
          });
          return;
        }
        try {
          await sendPatientDownloadInvite({
            doctorId: user.id,
            to: email,
            patientDisplayName: appointment?.patientName,
          });
          setToast({ visible: true, message: 'Invitation email queued.', type: 'success' });
        } catch {
          setToast({ visible: true, message: 'Failed to queue invitation email.', type: 'error' });
        }
      },
    },
    {
      key: 'invoice',
      label: 'Invoice',
      icon: '💳',
      enabled: true,
      onClick: () => {
        if (appointment?.id) navigate(`/invoices/new/${appointment.id}`);
        else setToast({ visible: true, message: 'Appointment not loaded', type: 'error' });
      },
    },
    {
      key: 'print',
      label: 'Print docs',
      icon: '🖨',
      enabled: true,
      onClick: handleManualPrintDocuments,
    },
    {
      key: 'followup',
      label: 'Follow-up',
      icon: '✉',
      enabled: true,
      onClick: () => setShowFollowUpModal(true),
    },
    {
      key: 'record',
      label: 'Record session',
      icon: '🎙',
      enabled: true,
      onClick: () => setShowRecorder(true),
    },
  ] as Array<{ key: string; label: string; icon: string; enabled: boolean; onClick: () => void }>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <p className="text-foreground">Loading post consult...</p>
      </div>
    );
  }

  if (!appointment || error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <button
          onClick={() => navigateBack('/appointments')}
          className="mb-4 rounded-lg border border-border bg-card px-4 py-2 text-foreground"
        >
          Back
        </button>
        <p className="text-destructive">{error || 'Appointment not found.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      {showRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Record session</h2>
              <button onClick={cancelRecording} className="text-gray-500">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700">Title</label>
                <input value={recordingTitle} onChange={(e) => setRecordingTitle(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <button onClick={startRecording} className="px-4 py-2 bg-red-600 text-white rounded">Start</button>
                ) : (
                  <button onClick={() => { setIsRecording(false); const mr = mediaRecorderRef.current; if (mr) mr.stop(); }} className="px-4 py-2 bg-yellow-500 text-white rounded">Stop</button>
                )}
                <div className="text-sm text-gray-600">{isRecording ? 'Recording…' : recordedChunks.length ? `${(recordedChunks.reduce((s, c) => s + (c as Blob).size, 0) / 1024).toFixed(1)} KB recorded` : 'No recording yet'}</div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={cancelRecording} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={stopAndUploadRecording} disabled={isUploadingRecording || recordedChunks.length === 0} className="px-4 py-2 bg-green-600 text-white rounded">{isUploadingRecording ? 'Saving…' : 'Save recording'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-[30px] border border-[#D8DEE5] bg-white shadow-sm p-6 space-y-6">
          <div className="mb-8 relative">
          <button
            onClick={() => navigateBack('/appointments')}
            className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-2xl text-foreground"
          >
            ←
          </button>
          <h1 className="text-3xl font-semibold text-foreground sm:text-3xl text-center w-full">Post consult</h1>
        </div>

        

        {latestPrescriptionDraft && (
          <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">Saved prescription draft</p>
            <p
              className="mt-2 text-sm text-muted-foreground"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {latestPrescriptionDraft.content}
            </p>
            <button
              type="button"
              onClick={previewPrescription}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
            >
              <Eye className="h-4 w-4" />
              View prescription
            </button>
          </div>
        )}

        <div className="mb-4 text-lg font-semibold tracking-wide text-foreground">CLINICAL ACTIONS</div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actionConfig.map((action) => (
            <button
              key={action.key}
              onClick={action.enabled ? action.onClick : undefined}
              className={actionButtonClass}
              disabled={!action.enabled}
            >
              <span className="mr-2">{action.icon}</span> {action.label}
            </button>
          ))}
        </div>

        {documents.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Documents</h2>
            <div className="mt-3 space-y-2">
              {documents.slice(0, 5).map((doc) => (
                <a
                  key={doc.id}
                  href={doc.downloadURL}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                >
                  <p className="font-medium text-foreground">{doc.title || doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.fileName} • {formatFileSize(doc.fileSize)}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

        {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Manage prescription</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Save draft, preview as PDF, or export a real PDF file.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="rounded-md border border-border bg-card p-2 text-muted-foreground transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium text-foreground">Prescription *</label>
            <textarea
              value={prescriptionDraft}
              onChange={(e) => setPrescriptionDraft(e.target.value)}
              rows={8}
              placeholder="e.g. Medication, dosage, instructions…"
              className="w-full rounded-md border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={savePrescriptionDraft}
                disabled={isSavingPrescription}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSavingPrescription ? 'Saving...' : 'Save draft'}
              </button>

              <button
                type="button"
                onClick={previewPrescription}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
              >
                <Eye className="h-4 w-4" />
                Preview PDF
              </button>

              <button
                type="button"
                onClick={exportPrescription}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export as PDF
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDoctorLetterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Generate doctor letter</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Save draft, preview as PDF, or export a real PDF file.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDoctorLetterModal(false)}
                className="rounded-md border border-border bg-card p-2 text-muted-foreground transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium text-foreground">Doctor letter *</label>
            <textarea
              value={doctorLetterDraft}
              onChange={(e) => setDoctorLetterDraft(e.target.value)}
              rows={8}
              placeholder="e.g. Referral summary, diagnosis, and plan..."
              className="w-full rounded-md border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={saveDoctorLetterDraft}
                disabled={isSavingDoctorLetter}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSavingDoctorLetter ? 'Saving...' : 'Save draft'}
              </button>

              <button
                type="button"
                onClick={previewDoctorLetter}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
              >
                <Eye className="h-4 w-4" />
                Preview PDF
              </button>

              <button
                type="button"
                onClick={exportDoctorLetter}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export as PDF
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDoctorLetterModal(false)}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            <div className="border-b border-border p-4">
              <h2 className="text-xl font-semibold text-foreground">Add note</h2>
            </div>
            <div className="p-4">
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                rows={7}
                className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Write your clinical note..."
              />
            </div>
            <div className="flex gap-3 border-t border-border bg-muted p-4">
              <button
                onClick={saveNote}
                disabled={isSavingNote}
                className="flex-1 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isSavingNote ? 'Saving...' : 'Save note'}
              </button>
              <button
                onClick={() => setShowNoteModal(false)}
                className="flex-1 rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            <div className="border-b border-border p-4">
              <h2 className="text-xl font-semibold text-foreground">
                {documentMode === 'scan' ? 'Scan document' : 'Upload document'}
              </h2>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Title (optional)</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Referral"
                />
              </div>

              <input
                ref={fileRef}
                type="file"
                accept={documentMode === 'scan' ? 'image/*' : 'image/*,application/pdf'}
                capture={documentMode === 'scan' ? 'environment' : undefined}
                onChange={handleDocumentPicked}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-md border border-border bg-card px-4 py-3 text-left text-foreground transition hover:bg-muted"
              >
                {documentMode === 'scan' ? 'Open camera' : 'Choose file'}
              </button>

              {documentFile && (
                <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
                  <p className="font-medium">{documentFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(documentFile.size)}</p>
                </div>
              )}

              {documentPreview && (
                <div className="overflow-hidden rounded-lg border border-border">
                  <img src={documentPreview} alt="Preview" className="max-h-60 w-full object-cover" />
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-border bg-muted p-4">
              <button
                onClick={saveDocument}
                disabled={!documentFile || isSavingDocument}
                className="flex-1 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isSavingDocument ? 'Saving...' : 'Save to record'}
              </button>
              <button
                onClick={closeDocumentModal}
                className="flex-1 rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowUpModal && (
        <CreateAppointmentModal
          isOpen={showFollowUpModal}
          onClose={() => setShowFollowUpModal(false)}
          onAppointmentCreated={() => {
            setShowFollowUpModal(false);
            setToast({ visible: true, message: 'Follow-up appointment created.', type: 'success' });
          }}
          prefillPatientId={appointment.isManual ? undefined : appointment.patientId}
          prefillPatientName={appointment.patientName}
          prefillPatientEmail={appointment.patientEmail}
          prefillIsManual={appointment.isManual}
          consultTypeDefault="follow-up"
        />
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-xl font-semibold text-foreground">
                {previewPdfType === 'doctor-letter' && 'Doctor Letter PDF Preview'}
                {previewPdfType === 'manual-documents' && 'Manual Documents PDF Preview'}
                {previewPdfType === 'prescription' && 'Prescription PDF Preview'}
              </h2>
              <button
                type="button"
                onClick={closePreviewModal}
                className="rounded-md border border-border bg-card p-2 text-muted-foreground transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                className="flex-1 border-0"
                title="Prescription PDF Preview"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                PDF preview is not available. Please export the PDF.
              </div>
            )}
            <div className="flex gap-3 border-t border-border bg-muted p-4">
              <button
                type="button"
                onClick={printPreviewPdf}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <Printer className="h-4 w-4" />
                Print PDF
              </button>
              <button
                type="button"
                onClick={handlePreviewExport}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export as PDF
              </button>
              <button
                type="button"
                onClick={closePreviewModal}
                className="flex-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostConsultPage;
