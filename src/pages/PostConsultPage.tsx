import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Download,
  Eye,
  Printer,
  Save,
  Video,
} from 'lucide-react';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { VisitPatientBriefing } from '../components/appointments/VisitChartSnapshot';
import { Toast, PostConsultSkeleton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import {
  addAppointmentDocument,
  getAppointmentById,
  getDoctorAppointments,
  syncAppointmentStatus,
  updateAppointment,
} from '../services/appointmentService';
import { Appointment, AppointmentDocument, PostConsultAction, PostConsultActionType } from '../types';
import {
  canDoctorStartVideoCall,
  formatAppointmentTypeLabel,
  isWhatsAppComingSoon,
} from '../utils/teleconsult';
import { sendPatientDownloadInvite } from '../services/patientManagementService';
import { COMMON_ICD10_CODES, isValidNappiCode } from '../lib/southAfrica';

type DocumentMode = 'scan' | 'upload';

interface LocationState {
  appointment?: Appointment;
  fromTeleconsult?: boolean;
}

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
const doctor = user?.role === 'doctor' ? user : null;

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
  const [documentMode, setDocumentMode] = useState<DocumentMode>('upload');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionDraft, setPrescriptionDraft] = useState('');
  const [nappiCode, setNappiCode] = useState('');
  const [icd10Code, setIcd10Code] = useState('');
  const [icd10Custom, setIcd10Custom] = useState('');
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [showDoctorLetterModal, setShowDoctorLetterModal] = useState(false);
  const [doctorLetterDraft, setDoctorLetterDraft] = useState('');
  const [letterIcd10Code, setLetterIcd10Code] = useState('');
  const [letterIcd10Custom, setLetterIcd10Custom] = useState('');
  const [isSavingDoctorLetter, setIsSavingDoctorLetter] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfType, setPreviewPdfType] = useState<'prescription' | 'doctor-letter' | 'manual-documents'>('prescription');
  const [isCompletingVisit, setIsCompletingVisit] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [teleconsultConsentChecked, setTeleconsultConsentChecked] = useState(false);
  const [isSavingTeleconsultConsent, setIsSavingTeleconsultConsent] = useState(false);

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
          setTeleconsultConsentChecked(Boolean(direct.teleconsultConsent?.obtained));
          const existingCallNote = (direct.postConsultActions ?? []).find(
            (a) =>
              a.type === 'post_consult_note' &&
              (a.id === 'call_notes' || a.title === 'Call notes')
          );
          setNoteValue(existingCallNote?.content || '');
          return;
        }

        const allAppointments = await getDoctorAppointments(user.id);
        const found = allAppointments.find((item) => item.id === appointmentId) || null;
        if (!found) {
          setError('Appointment not found.');
          return;
        }

        setAppointment(found);
        const existingCallNote = (found.postConsultActions ?? []).find(
          (a) =>
            a.type === 'post_consult_note' &&
            (a.id === 'call_notes' || a.title === 'Call notes')
        );
        setNoteValue(existingCallNote?.content || '');
      } catch {
        setError('Failed to load this appointment.');
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

  const fromTeleconsult = Boolean((location.state as LocationState | undefined)?.fromTeleconsult);
  const callEnded = appointment?.teleconsult?.status === 'ended' || fromTeleconsult;

  const callNotes = useMemo(() => {
    const actions = appointment?.postConsultActions ?? [];
    return actions.find(
      (action) =>
        action.type === 'post_consult_note' &&
        (action.id === 'call_notes' || action.title === 'Call notes') &&
        action.content.trim().length > 0
    );
  }, [appointment?.postConsultActions]);

  const latestPrescriptionDraft = useMemo(() => {
    const actions = appointment?.postConsultActions ?? [];
    return actions
      .filter((action) => action.type === 'prescription_draft' && action.content.trim().length > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }, [appointment?.postConsultActions]);

  const latestDoctorLetter = useMemo(() => {
    const actions = appointment?.postConsultActions ?? [];
    return actions
      .filter((action) => action.type === 'doctor_letter_draft' && action.content.trim().length > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }, [appointment?.postConsultActions]);

  useEffect(() => {
    if (latestPrescriptionDraft) {
      setPrescriptionDraft(latestPrescriptionDraft.content);
    }
  }, [latestPrescriptionDraft]);

  useEffect(() => {
    if (latestDoctorLetter) {
      setDoctorLetterDraft(latestDoctorLetter.content);
    }
  }, [latestDoctorLetter]);

  const closeDocumentModal = () => {
    setShowDocumentModal(false);
    setDocumentMode('upload');
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
      const existingCallNote = (appointment.postConsultActions ?? []).find(
        (a) =>
          a.type === 'post_consult_note' &&
          (a.id === 'call_notes' || a.title === 'Call notes')
      );

      const noteAction: PostConsultAction = {
        id: 'call_notes',
        type: 'post_consult_note',
        title: 'Call notes',
        content: trimmedNote,
        status: 'draft',
        createdBy: user.id,
        createdAt: existingCallNote?.createdAt ?? now,
        updatedAt: now,
      };

      const others = (appointment.postConsultActions ?? []).filter(
        (a) =>
          !(a.type === 'post_consult_note' && (a.id === 'call_notes' || a.title === 'Call notes'))
      );
      const nextActions = trimmedNote ? [noteAction, ...others] : others;

      await persistActions(nextActions);
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

  const resolvedPrescriptionIcd10 =
    icd10Code === '__custom__' ? icd10Custom.trim() : icd10Code.trim();
  const resolvedLetterIcd10 =
    letterIcd10Code === '__custom__' ? letterIcd10Custom.trim() : letterIcd10Code.trim();

  const savePrescriptionDraft = async () => {
    if (!prescriptionDraft.trim()) {
      setToast({ visible: true, message: 'Prescription cannot be empty.', type: 'error' });
      return;
    }
    if (nappiCode.trim() && !isValidNappiCode(nappiCode)) {
      setToast({ visible: true, message: 'NAPPI code must be 5-7 digits.', type: 'error' });
      return;
    }

    try {
      setIsSavingPrescription(true);
      await appendPostConsultAction('prescription_draft', {
        title: 'Prescription draft',
        content: prescriptionDraft.trim(),
        metadata: {
          ...(nappiCode.trim() ? { nappiCode: nappiCode.trim() } : {}),
          ...(resolvedPrescriptionIcd10 ? { icd10Code: resolvedPrescriptionIcd10 } : {}),
        },
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
        metadata: {
          ...(resolvedLetterIcd10 ? { icd10Code: resolvedLetterIcd10 } : {}),
        },
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
    if (doctor?.licenseNumber) {
      doc.text(`HPCSA: ${doctor.licenseNumber}`, margin, cursorY);
      cursorY += 16;
    }
    if (doctor?.practiceNumberBhf) {
      doc.text(`BHF: ${doctor.practiceNumberBhf}`, margin, cursorY);
      cursorY += 16;
    }
    doc.text(`Patient: ${appointment?.patientName || 'Patient'}`, margin, cursorY);
    cursorY += 16;
    doc.text(`Appointment: ${appointmentDate}`, margin, cursorY);
    if (nappiCode.trim()) {
      cursorY += 16;
      doc.text(`NAPPI: ${nappiCode.trim()}`, margin, cursorY);
    }
    if (resolvedPrescriptionIcd10) {
      cursorY += 16;
      doc.text(`ICD-10: ${resolvedPrescriptionIcd10}`, margin, cursorY);
    }

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
    if (doctor?.licenseNumber) {
      doc.text(`HPCSA: ${doctor.licenseNumber}`, margin, cursorY);
      cursorY += 16;
    }
    if (doctor?.practiceNumberBhf) {
      doc.text(`BHF: ${doctor.practiceNumberBhf}`, margin, cursorY);
      cursorY += 16;
    }
    doc.text(`Patient: ${appointment?.patientName || 'Patient'}`, margin, cursorY);
    cursorY += 16;
    doc.text(`Appointment: ${appointmentDate}`, margin, cursorY);
    if (resolvedLetterIcd10) {
      cursorY += 16;
      doc.text(`ICD-10: ${resolvedLetterIcd10}`, margin, cursorY);
    }

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

  if (isLoading) {
    return <PostConsultSkeleton />;
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

  const canStartCall = canDoctorStartVideoCall(appointment);
  const whatsappSoon = isWhatsAppComingSoon(appointment);
  const visitCompleted = appointment.status === 'completed';
  const hasClinicalNote = Boolean(callNotes?.content?.trim() || noteValue.trim());
  const hasPrescription = Boolean(latestPrescriptionDraft);
  const hasLetter = Boolean(latestDoctorLetter);
  const hasDocuments = documents.length > 0;

  const startVideoCall = () => {
    if (!teleconsultConsentChecked) return;
    navigate(`/teleconsult/${appointment.id}`, { state: { appointment } });
  };

  const handleTeleconsultConsentChange = async (checked: boolean) => {
    setTeleconsultConsentChecked(checked);
    if (!checked || !user?.id || !appointment) return;

    try {
      setIsSavingTeleconsultConsent(true);
      const consent = { obtained: true, at: new Date(), by: user.id };
      await updateAppointment(user.id, appointment.id, { teleconsultConsent: consent });
      setAppointment((prev) => (prev ? { ...prev, teleconsultConsent: consent } : prev));
    } catch {
      setToast({
        visible: true,
        message: 'Failed to save telemedicine consent confirmation.',
        type: 'error',
      });
      setTeleconsultConsentChecked(false);
    } finally {
      setIsSavingTeleconsultConsent(false);
    }
  };

  const markVisitCompleted = async () => {
    if (!user?.id || visitCompleted || isCompletingVisit) return;
    try {
      setIsCompletingVisit(true);
      const trimmed = noteValue.trim();
      if (trimmed && trimmed !== (callNotes?.content || '').trim()) {
        const now = new Date();
        const existingCallNote = (appointment.postConsultActions ?? []).find(
          (a) =>
            a.type === 'post_consult_note' &&
            (a.id === 'call_notes' || a.title === 'Call notes')
        );
        const noteAction: PostConsultAction = {
          id: 'call_notes',
          type: 'post_consult_note',
          title: 'Call notes',
          content: trimmed,
          status: 'draft',
          createdBy: user.id,
          createdAt: existingCallNote?.createdAt ?? now,
          updatedAt: now,
        };
        const others = (appointment.postConsultActions ?? []).filter(
          (a) =>
            !(a.type === 'post_consult_note' && (a.id === 'call_notes' || a.title === 'Call notes'))
        );
        await persistActions([noteAction, ...others]);
      }
      await updateAppointment(user.id, appointment.id, { status: 'completed' });
      await syncAppointmentStatus(appointment.id);
      setAppointment((prev) => (prev ? { ...prev, status: 'completed' } : prev));
      setToast({ visible: true, message: 'Visit marked completed.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to complete visit.', type: 'error' });
    } finally {
      setIsCompletingVisit(false);
    }
  };

  const invitePatientToApp = async () => {
    if (!user?.id || isSendingInvite) return;
    const email = appointment.patientEmail?.trim();
    if (!email) {
      setToast({
        visible: true,
        message: 'Add a patient email on this appointment before sending an invite.',
        type: 'error',
      });
      return;
    }
    try {
      setIsSendingInvite(true);
      await sendPatientDownloadInvite({
        doctorId: user.id,
        to: email,
        patientDisplayName: appointment.patientName,
      });
      setToast({ visible: true, message: 'App invite emailed to the patient.', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Failed to send invite.', type: 'error' });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const dateLabel = appointment.date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-full bg-[#f8fafc] px-4 py-6 sm:px-6 lg:px-8">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      {showRecorder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[14px] border border-[#e1e7ef] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0E2340]">Record session</h2>
              <button type="button" onClick={cancelRecording} className="text-[#65758b]">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[#65758b]">Title</label>
                <input
                  value={recordingTitle}
                  onChange={(e) => setRecordingTitle(e.target.value)}
                  className="h-10 w-full rounded-[10px] border border-[#e1e7ef] px-3 text-sm outline-none focus:border-anixi-green"
                />
              </div>

              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <button type="button" onClick={startRecording} className="rounded-[10px] bg-red-600 px-4 py-2 text-sm font-semibold text-white">Start</button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecording(false);
                      const mr = mediaRecorderRef.current;
                      if (mr) mr.stop();
                    }}
                    className="rounded-[10px] bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Stop
                  </button>
                )}
                <div className="text-sm text-[#65758b]">
                  {isRecording
                    ? 'Recording…'
                    : recordedChunks.length
                      ? `${(recordedChunks.reduce((s, c) => s + (c as Blob).size, 0) / 1024).toFixed(1)} KB recorded`
                      : 'No recording yet'}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancelRecording} className="rounded-[10px] border border-[#e1e7ef] px-4 py-2 text-sm font-medium">Cancel</button>
                <button
                  type="button"
                  onClick={stopAndUploadRecording}
                  disabled={isUploadingRecording || recordedChunks.length === 0}
                  className="rounded-[10px] bg-anixi-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isUploadingRecording ? 'Saving…' : 'Save recording'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-5 pb-28 pt-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigateBack(`/appointments/${appointment.id}`)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e1e7ef] bg-white text-[#65758b] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340]"
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">
                {callEnded ? 'After the visit' : 'Pre-call briefing'}
              </h1>
              {!callEnded && canStartCall && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4f1] px-2.5 py-0.5 text-[11px] font-semibold text-anixi-green">
                  <Video className="h-3 w-3" />
                  Video consultation
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-[#65758b]">
              {appointment.patientName}
              {appointment.time ? ` · ${appointment.time}` : ''}
              {' · '}
              {callEnded
                ? 'Document, prescribe, schedule follow-up, then close the chart'
                : 'Review the chart, then join when you and the patient are ready'}
            </p>
          </div>
        </div>

        {callEnded ? (
          <>
            {/* Encounter summary */}
            <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] px-5 py-4">
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">Patient</p>
                  <p className="mt-1 text-sm font-semibold text-[#0E2340]">{appointment.patientName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">When</p>
                  <p className="mt-1 text-sm font-medium text-[#344256]">
                    {dateLabel}
                    {appointment.time ? ` · ${appointment.time}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">Type</p>
                  <p className="mt-1 text-sm font-medium text-[#344256]">
                    {formatAppointmentTypeLabel(appointment)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">Status</p>
                  <p className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        visitCompleted
                          ? 'bg-slate-200/60 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${visitCompleted ? 'bg-slate-400' : 'bg-amber-500'}`} />
                      {visitCompleted ? 'Completed' : 'Needs wrap-up'}
                    </span>
                  </p>
                </div>
              </div>
              {appointment.notes ? (
                <p className="mt-3 border-t border-[#e1e7ef] pt-3 text-[13px] leading-relaxed text-[#344256]">
                  <span className="font-semibold text-[#8FA0B6]">Booking agenda: </span>
                  {appointment.notes}
                </p>
              ) : null}
            </div>

            {/* 1. Clinical documentation */}
            <section className="rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#0E2340] text-[10px] font-bold text-white">1</span>
                    Clinical note
                  </p>
                  <p className="mt-1.5 text-[13px] text-[#65758b]">
                    Finalize what you documented during the visit (symptoms, assessment, plan).
                  </p>
                </div>
                {hasClinicalNote && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    On file
                  </span>
                )}
              </div>
              <div className="px-5 pb-5">
                <textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  rows={6}
                  placeholder="Chief complaint, findings, assessment, plan…"
                  className="mt-2 w-full rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-3.5 py-3 text-sm leading-relaxed text-[#344256] outline-none transition focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/20"
                />
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void saveNote()}
                    disabled={isSavingNote}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-anixi-green px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f] disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSavingNote ? 'Saving…' : 'Save clinical note'}
                  </button>
                </div>
              </div>
            </section>

            {/* 2. Orders & paperwork */}
            <section className="rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
              <div className="px-5 pt-5 pb-1">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#0E2340] text-[10px] font-bold text-white">2</span>
                  Orders & paperwork
                </p>
                <p className="mt-1.5 text-[13px] text-[#65758b]">
                  Write prescriptions, letters, and attach anything that belongs in the chart.
                </p>
              </div>
              <div className="divide-y divide-[#e1e7ef] px-5 pb-2">
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(true)}
                  className="group flex w-full items-center gap-4 py-3.5 text-left transition"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0E2340]">Prescription</p>
                    <p className="mt-0.5 text-xs text-[#65758b]">
                      {hasPrescription ? 'Draft on file - review or update' : 'Draft medications for this visit'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-[#e1e7ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#344256] shadow-sm transition group-hover:border-anixi-green group-hover:text-anixi-green">
                    {hasPrescription ? 'Edit' : 'Add'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDoctorLetterModal(true)}
                  className="group flex w-full items-center gap-4 py-3.5 text-left transition"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0E2340]">Doctor letter / referral</p>
                    <p className="mt-0.5 text-xs text-[#65758b]">
                      {hasLetter ? 'Draft on file - review or update' : 'Referral or to-whom-it-may-concern letter'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-[#e1e7ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#344256] shadow-sm transition group-hover:border-anixi-green group-hover:text-anixi-green">
                    {hasLetter ? 'Edit' : 'Add'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDocumentModal(true)}
                  className="group flex w-full items-center gap-4 py-3.5 text-left transition"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition group-hover:bg-amber-100">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0E2340]">Attach document</p>
                    <p className="mt-0.5 text-xs text-[#65758b]">
                      {hasDocuments
                        ? `${documents.length} file${documents.length === 1 ? '' : 's'} on this visit`
                        : 'Scan or upload results, forms, or external reports'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-[#e1e7ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#344256] shadow-sm transition group-hover:border-anixi-green group-hover:text-anixi-green">
                    {hasDocuments ? 'Add more' : 'Upload'}
                  </span>
                </button>
              </div>
            </section>

            {/* 3. Continuity */}
            <section className="rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
              <div className="px-5 pt-5 pb-1">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#0E2340] text-[10px] font-bold text-white">3</span>
                  Continuity of care
                </p>
                <p className="mt-1.5 text-[13px] text-[#65758b]">
                  Set the next step for the patient before they leave your desk.
                </p>
              </div>
              <div className="grid gap-3 px-5 pb-5 pt-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(true)}
                  className="group flex items-start gap-3 rounded-xl border border-[#e1e7ef] bg-[#f8fafc] px-4 py-3.5 text-left transition hover:border-anixi-green/40 hover:bg-[#f0f5f2]"
                >
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-100">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0E2340]">Book follow-up</p>
                    <p className="mt-0.5 text-xs text-[#65758b]">Schedule the next appointment</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void invitePatientToApp()}
                  disabled={isSendingInvite || !appointment.patientEmail?.trim()}
                  className="group flex items-start gap-3 rounded-xl border border-[#e1e7ef] bg-[#f8fafc] px-4 py-3.5 text-left transition hover:border-anixi-green/40 hover:bg-[#f0f5f2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition group-hover:bg-sky-100">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0E2340]">
                      {isSendingInvite ? 'Sending invite…' : 'Invite to Anixi app'}
                    </p>
                    <p className="mt-0.5 text-xs text-[#65758b]">
                      {appointment.patientEmail?.trim()
                        ? 'Send the patient download / signup email'
                        : 'Add a patient email on the appointment first'}
                    </p>
                  </div>
                </button>
              </div>
            </section>

            {/* 4. Billing */}
            <section className="rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
              <div className="px-5 pt-5 pb-1">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#0E2340] text-[10px] font-bold text-white">4</span>
                  Billing
                </p>
                <p className="mt-1.5 text-[13px] text-[#65758b]">
                  Raise the invoice for this visit, then close the chart from the bar below.
                </p>
              </div>
              <div className="px-5 pb-5 pt-3">
                <button
                  type="button"
                  onClick={() => navigate(`/invoices/new/${appointment.id}`)}
                  className="group inline-flex h-10 items-center gap-2.5 rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-4 text-sm font-semibold text-[#344256] shadow-sm transition hover:border-anixi-green hover:bg-white hover:text-anixi-green"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  Create invoice
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            {user?.id && (
              <VisitPatientBriefing
                doctorId={user.id}
                patientId={appointment.patientId}
                isManual={appointment.isManual}
                patientName={appointment.patientName}
                patientEmail={appointment.patientEmail}
              />
            )}

            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                    Visit agenda
                  </p>
                  {appointment.notes ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#344256]">
                      {appointment.notes}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[#94a3b8]">
                      No reason recorded. Confirm why they booked when you join.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowNoteModal(true)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-xs font-semibold text-[#344256] hover:border-anixi-green/40 hover:text-anixi-green"
                >
                  Add visit note
                </button>
              </div>
              {whatsappSoon && (
                <div className="mt-3 inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                  WhatsApp visit — coming soon
                </div>
              )}
            </div>

            {latestPrescriptionDraft && (
              <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4">
                <p className="text-sm font-medium text-[#0E2340]">Saved prescription draft</p>
                <p
                  className="mt-2 text-sm text-[#65758b]"
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
                  className="mt-3 inline-flex items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 py-2 text-sm font-semibold text-[#344256] hover:border-anixi-green/40"
                >
                  <Eye className="h-4 w-4" />
                  View prescription
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {canStartCall && !callEnded && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e1e7ef] bg-white/95 px-4 py-4 shadow-[0_-8px_24px_rgba(14,35,64,0.08)] backdrop-blur-md md:left-64">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-xl border border-[#e1e7ef] bg-[#f6f8fa] px-3.5 py-3 text-[13px] text-[#344256]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-anixi-green focus:ring-anixi-green"
                checked={teleconsultConsentChecked}
                disabled={isSavingTeleconsultConsent}
                onChange={(e) => void handleTeleconsultConsentChange(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-[#0E2340]">Telemedicine consent</span>
                <span className="mt-0.5 block text-[#65758b]">
                  Patient consented to a video consult (HPCSA telemedicine guidance).
                </span>
              </span>
            </label>
            <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
              {!teleconsultConsentChecked ? (
                <p className="text-center text-[12px] text-[#8FA0B6] sm:text-right">
                  Confirm consent to start the video call
                </p>
              ) : (
                <p className="text-center text-[12px] text-[#65758b] sm:text-right">
                  Ready for {appointment.patientName}
                  {appointment.time ? ` at ${appointment.time}` : ''}
                </p>
              )}
              <button
                type="button"
                onClick={startVideoCall}
                disabled={!teleconsultConsentChecked || isSavingTeleconsultConsent}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-anixi-green px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f] disabled:cursor-not-allowed disabled:bg-[#c5d0cb] disabled:text-white sm:w-auto"
              >
                <Video className="h-4 w-4" />
                Start video call
              </button>
            </div>
          </div>
        </div>
      )}

      {callEnded && !visitCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e1e7ef] bg-white/80 px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md md:left-64">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-[#65758b]">
              {hasClinicalNote
                ? 'When documentation and billing are done, close the chart.'
                : 'Save a clinical note before closing the chart when possible.'}
            </p>
            <button
              type="button"
              onClick={() => void markVisitCompleted()}
              disabled={isCompletingVisit}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0E2340] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#16325a] disabled:opacity-60 sm:w-auto"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {isCompletingVisit ? 'Closing…' : 'Mark visit completed'}
            </button>
          </div>
        </div>
      )}

      {callEnded && visitCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e1e7ef] bg-white/80 px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md md:left-64">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-[#65758b]">This visit is closed. Notes and drafts remain on the chart.</p>
            <button
              type="button"
              onClick={() => navigateBack('/appointments')}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-anixi-green px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f] sm:w-auto"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back to appointments
            </button>
          </div>
        </div>
      )}

        {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#e1e7ef] bg-white shadow-xl">
            <div className="relative px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-gray-900">Manage Prescription</h2>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 px-6 pb-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NAPPI code</label>
                  <input
                    type="text"
                    value={nappiCode}
                    onChange={(e) => setNappiCode(e.target.value.replace(/\D/g, '').slice(0, 7))}
                    placeholder="5-7 digits"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 code</label>
                  <select
                    value={icd10Code}
                    onChange={(e) => setIcd10Code(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select diagnosis code</option>
                    {COMMON_ICD10_CODES.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.code} - {entry.description}
                      </option>
                    ))}
                    <option value="__custom__">Other (enter manually)</option>
                  </select>
                  {icd10Code === '__custom__' && (
                    <input
                      type="text"
                      value={icd10Custom}
                      onChange={(e) => setIcd10Custom(e.target.value)}
                      placeholder="e.g. M54.5"
                      className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescription *</label>
                <textarea
                  value={prescriptionDraft}
                  onChange={(e) => setPrescriptionDraft(e.target.value)}
                  rows={8}
                  placeholder="e.g. Medication, dosage, instructions…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={savePrescriptionDraft}
                  disabled={isSavingPrescription}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-anixi-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-anixi-green/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingPrescription ? 'Saving…' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  onClick={previewPrescription}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <Eye className="h-4 w-4" />
                  Preview PDF
                </button>

                <button
                  type="button"
                  onClick={exportPrescription}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 pt-2">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="flex-1 rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f3f6fa]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDoctorLetterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#e1e7ef] bg-white shadow-xl">
            <div className="relative px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-gray-900">Doctor Letter</h2>
              <button
                type="button"
                onClick={() => setShowDoctorLetterModal(false)}
                className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 px-6 pb-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 diagnosis code</label>
                <select
                  value={letterIcd10Code}
                  onChange={(e) => setLetterIcd10Code(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select diagnosis code</option>
                  {COMMON_ICD10_CODES.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.code} - {entry.description}
                    </option>
                  ))}
                  <option value="__custom__">Other (enter manually)</option>
                </select>
                {letterIcd10Code === '__custom__' && (
                  <input
                    type="text"
                    value={letterIcd10Custom}
                    onChange={(e) => setLetterIcd10Custom(e.target.value)}
                    placeholder="e.g. I10"
                    className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor letter *</label>
                <textarea
                  value={doctorLetterDraft}
                  onChange={(e) => setDoctorLetterDraft(e.target.value)}
                  rows={8}
                  placeholder="e.g. Referral summary, diagnosis, and plan…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={saveDoctorLetterDraft}
                  disabled={isSavingDoctorLetter}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-anixi-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-anixi-green/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingDoctorLetter ? 'Saving…' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  onClick={previewDoctorLetter}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <Eye className="h-4 w-4" />
                  Preview PDF
                </button>

                <button
                  type="button"
                  onClick={exportDoctorLetter}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 pt-2">
              <button
                type="button"
                onClick={() => setShowDoctorLetterModal(false)}
                className="flex-1 rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f3f6fa]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-2xl border border-[#e1e7ef] bg-white shadow-xl">
            <div className="relative px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-gray-900">Clinical Note</h2>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="px-6 pb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                rows={7}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Chief complaint, findings, assessment, plan…"
              />
            </div>
            <div className="flex gap-3 px-6 py-4 pt-2">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="flex-1 rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f3f6fa]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={isSavingNote}
                className="flex-1 rounded-[10px] bg-anixi-green px-4 py-2 text-white transition-colors hover:bg-anixi-green/90 disabled:opacity-50"
              >
                {isSavingNote ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#e1e7ef] bg-white shadow-xl">
            <div className="relative px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-gray-900">Attach Document</h2>
              <button
                type="button"
                onClick={closeDocumentModal}
                className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 px-6 pb-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentMode('upload');
                      setDocumentFile(null);
                      if (documentPreview) { URL.revokeObjectURL(documentPreview); setDocumentPreview(null); }
                    }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      documentMode === 'upload'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📁 From computer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentMode('scan');
                      setDocumentFile(null);
                      if (documentPreview) { URL.revokeObjectURL(documentPreview); setDocumentPreview(null); }
                    }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      documentMode === 'scan'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📷 Scan with camera
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Referral, Lab results"
                />
              </div>

              <input
                ref={fileRef}
                type="file"
                accept={documentMode === 'scan' ? 'image/*' : 'image/*,application/pdf,.doc,.docx'}
                capture={documentMode === 'scan' ? 'environment' : undefined}
                onChange={handleDocumentPicked}
                className="hidden"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-md text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {documentFile
                    ? documentFile.name
                    : documentMode === 'scan'
                      ? 'Open camera to capture…'
                      : 'Choose file from computer…'}
                </button>
              </div>

              {documentFile && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="font-medium">{documentFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(documentFile.size)}</p>
                </div>
              )}

              {documentPreview && (
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <img src={documentPreview} alt="Preview" className="max-h-48 w-full object-contain bg-gray-50" />
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 pt-2">
              <button
                type="button"
                onClick={closeDocumentModal}
                className="flex-1 rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f3f6fa]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDocument}
                disabled={!documentFile || isSavingDocument}
                className="flex-1 rounded-[10px] bg-anixi-green px-4 py-2 text-white transition-colors hover:bg-anixi-green/90 disabled:opacity-50"
              >
                {isSavingDocument ? 'Saving…' : 'Save to Record'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-4xl rounded-2xl border border-[#e1e7ef] bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="relative px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {previewPdfType === 'doctor-letter' && 'Doctor Letter Preview'}
                {previewPdfType === 'manual-documents' && 'Document Preview'}
                {previewPdfType === 'prescription' && 'Prescription Preview'}
              </h2>
              <button
                type="button"
                onClick={closePreviewModal}
                className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            {previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                className="flex-1 border-0 mx-6 mb-2 rounded-md border border-gray-200"
                title="PDF Preview"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-500">
                PDF preview is not available. Please export the PDF.
              </div>
            )}
            <div className="flex gap-3 px-6 py-4">
              <button
                type="button"
                onClick={closePreviewModal}
                className="flex-1 rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f3f6fa]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={printPreviewPdf}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                type="button"
                onClick={handlePreviewExport}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-[10px] bg-anixi-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-anixi-green/90"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostConsultPage;
