import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AyahCommandBoard } from '../components/ayah/AyahCommandBoard';
import { AyahWorkspace, type AyahFileUpload } from '../components/ayah/AyahWorkspace';
import { useAyahChat } from '../context/AyahChatContext';
import { useAskAnixi } from '../context/AskAnixiContext';
import { useAuth } from '../hooks/useAuth';
import { useAyahPatientChart } from '../hooks/useAyahPatientChart';
import {
  useDoctorBriefingData,
  type AttentionItem,
} from '../hooks/useDoctorBriefingData';
import { commandNeedsPatient, PRACTICE_COMMANDS, type AyahCommand } from '../lib/ayahCommands';
import { formatAyahReply } from '../lib/formatAyahReply';
import { clinicianGivenName, clinicianHeaderLabel } from '../lib/clinicianName';
import { loadAyahPatientChart } from '../services/ayahPatientChart';
import {
  formatAskAnixiError,
  listDoctorPendingDrafts,
  resolveDoctorDraft,
  streamAskAnixi,
  type AskAnixiContext,
  type DoctorAgentDraft,
} from '../services/askAnixiService';
import {
  parsePatientBulkCsv,
  importPracticePatientsBulk,
} from '../services/bulkPatientImportService';
import { AyahVoicePanel } from '../components/ayah/AyahVoicePanel';
import { useAyahVoiceConversation } from '../hooks/useAyahVoiceConversation';
import { persistClinicalReportDraftForAppointment } from '../lib/clinicalReportAyahBridge';
import {
  parseDoctorBulkCsv,
  createPracticeInvitesBulk,
} from '../services/bulkInviteService';
import {
  djangoApplyUnichart,
  djangoPreviewUnichart,
  type UnichartPreview,
} from '../services/djangoApiService';
import { resolveAyahVoiceLanguage } from '../lib/resolveAyahVoiceLanguage';
import {
  unichartAgentContextSuffix,
  wantsUnichartApply,
} from '../lib/ayahUnichartContext';
import {
  mergeCompanionRequestContext,
  resolveAyahThreadId,
  resolveClinicAnchors,
} from '../lib/buildCompanionContext';

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const AyahPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, practiceSession } = useAuth();
  const { context, initialPrompt, autoSend, notifyDraftApproved, clearSessionPrompt, setContext } =
    useAskAnixi();
  const { loading: briefingLoading, snapshot, practiceSnapshot } = useDoctorBriefingData();
  const practiceSnapshotRef = useRef(practiceSnapshot);
  practiceSnapshotRef.current = practiceSnapshot;
  const patientChart = useAyahPatientChart(user?.id, context.patientId);
  const patientChartRef = useRef(patientChart);
  patientChartRef.current = patientChart;
  const { messages, hydrated, setMessages, resetToWelcome } = useAyahChat();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<DoctorAgentDraft[]>([]);
  const [showAIDisclaimer, setShowAIDisclaimer] = useState(false);
  const [aiDisclaimerAccepted, setAIDisclaimerAccepted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFileUploadRef = useRef<AyahFileUpload | null>(null);
  const [pendingUnichart, setPendingUnichart] = useState<UnichartPreview | null>(null);
  const pendingUnichartRef = useRef<UnichartPreview | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    pendingUnichartRef.current = pendingUnichart;
  }, [pendingUnichart]);

  const buildVoiceContext = useCallback(() => {
    const nextContext = contextRef.current;
    const clinicTimezone =
      (typeof practiceSnapshotRef.current?.timezone === 'string' &&
        practiceSnapshotRef.current.timezone) ||
      'Africa/Johannesburg';
    const chart =
      patientChartRef.current &&
      (!nextContext.patientId || patientChartRef.current.patientId === nextContext.patientId)
        ? patientChartRef.current
        : undefined;
    const voiceLanguage = resolveAyahVoiceLanguage({
      patientSnapshot: chart,
      fallback: 'en-ZA',
    });
    return mergeCompanionRequestContext(nextContext, {
      practiceSnapshot: practiceSnapshotRef.current as unknown as Record<string, unknown>,
      patientSnapshot: chart as unknown as Record<string, unknown> | undefined,
      clientSurface: 'voice',
      preferredLanguage: resolveAyahVoiceLanguage({
        patientSnapshot: chart,
        fallback: voiceLanguage,
      }),
      ...resolveClinicAnchors(clinicTimezone),
      voiceLanguage,
    });
  }, []);

  const voiceConversation = useAyahVoiceConversation({
    threadId: user?.id
      ? resolveAyahThreadId({
          surface: 'voice',
          userId: user.id,
          patientId: context.patientId,
        })
      : undefined,
    languageCode: resolveAyahVoiceLanguage({
      patientSnapshot: patientChart,
      fallback: 'en-ZA',
    }),
    getContext: buildVoiceContext,
    onTurn: ({ transcript, replyText }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-vu`,
          role: 'user',
          content: transcript,
          time: formatTime(),
        },
        {
          id: `${Date.now()}-va`,
          role: 'assistant',
          content: formatAyahReply(replyText),
          time: formatTime(),
        },
      ]);
    },
  });

  const firstName = clinicianGivenName(user?.displayName);
  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  const loadDrafts = useCallback(async () => {
    try {
      setPendingDrafts(await listDoctorPendingDrafts());
    } catch {
      setPendingDrafts([]);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    const hasAccepted = localStorage.getItem('ayah_ai_disclaimer_accepted');
    if (hasAccepted) {
      setAIDisclaimerAccepted(true);
    } else {
      setShowAIDisclaimer(true);
    }
  }, []);

  const handleAcceptAIDisclaimer = () => {
    localStorage.setItem('ayah_ai_disclaimer_accepted', 'true');
    setAIDisclaimerAccepted(true);
    setShowAIDisclaimer(false);
  };

  useEffect(scrollToBottom, [messages, streaming]);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: { hideUser?: boolean; context?: AskAnixiContext; displayText?: string },
    ) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || !user) return;

      if (!aiDisclaimerAccepted) {
        setShowAIDisclaimer(true);
        return;
      }

      const nextContext = options?.context ?? contextRef.current;
      let chart =
        patientChartRef.current &&
        (!nextContext.patientId || patientChartRef.current.patientId === nextContext.patientId)
          ? patientChartRef.current
          : undefined;
      if (!chart && nextContext.patientId) {
        chart = await loadAyahPatientChart(user.id, nextContext.patientId);
        patientChartRef.current = chart;
      }
      const clinicTimezone =
        (typeof practiceSnapshotRef.current?.timezone === 'string' &&
          practiceSnapshotRef.current.timezone) ||
        'Africa/Johannesburg';
      const anchors = resolveClinicAnchors(clinicTimezone);
      const preview = pendingUnichartRef.current;
      const agentText = `${trimmed}${unichartAgentContextSuffix(preview)}`;
      const preferredLanguage =
        (chart as { preferredLanguage?: string } | undefined)?.preferredLanguage ||
        (chart as { language?: string } | undefined)?.language;
      const requestContext = mergeCompanionRequestContext(nextContext, {
        practiceSnapshot: practiceSnapshotRef.current as unknown as Record<string, unknown>,
        patientSnapshot: chart as unknown as Record<string, unknown> | undefined,
        unichartPreview: preview,
        clientSurface: 'doctor-ayah',
        preferredLanguage,
        ...anchors,
      });
      const assistantId = `${Date.now()}-a`;
      setMessages((prev) => [
        ...prev,
        ...(options?.hideUser
          ? []
          : [
              {
                id: `${Date.now()}-u`,
                role: 'user' as const,
                content: options?.displayText?.trim() || trimmed,
                time: formatTime(),
              },
            ]),
        { id: assistantId, role: 'assistant', content: '', time: formatTime() },
      ]);
      setInput('');
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let accumulated = '';

      try {
        await streamAskAnixi({
          message: agentText,
          context: requestContext,
          threadId: resolveAyahThreadId({
            surface: 'doctor-ayah',
            userId: user.id,
            patientId: requestContext.patientId,
          }),
          signal: controller.signal,
          onChunk: (chunk: string) => {
            accumulated += chunk;
            const visible = formatAyahReply(accumulated);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m)),
            );
          },
        });

        const visible = formatAyahReply(accumulated);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    visible.trim() ||
                    'I finished looking, but had nothing to add. Try “Today’s briefing” or ask again.',
                }
              : m,
          ),
        );
      } catch (err) {
        const msg = formatAskAnixiError(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: formatAyahReply(msg) } : m,
          ),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
        void loadDrafts();
      }
    },
    [streaming, user, loadDrafts, setMessages, aiDisclaimerAccepted],
  );

  const applyPatientContext = useCallback(
    (next: AskAnixiContext) => {
      setContext(next);
      contextRef.current = next;
    },
    [setContext],
  );

  const runCommand = useCallback(
    (command: AyahCommand, override?: AskAnixiContext) => {
      const nextContext = override ?? contextRef.current;
      if (commandNeedsPatient(command, nextContext)) {
        const fallback = snapshot.nextAppointment;
        if (fallback?.patientId) {
          const scoped = {
            patientId: fallback.patientId,
            patientName: fallback.patientName,
            appointmentId: fallback.id,
          };
          applyPatientContext(scoped);
          void sendMessage(command.prompt, { context: scoped, displayText: command.label });
          return;
        }
        void sendMessage(
          `${command.prompt} No patient is in context. Ask me which patient if you cannot infer one from today’s panel.`,
          { displayText: command.label },
        );
        return;
      }
      void sendMessage(command.prompt, { context: nextContext, displayText: command.label });
    },
    [applyPatientContext, sendMessage, snapshot.nextAppointment],
  );

  useEffect(() => {
    const practiceId = practiceSession?.practice?.id;
    if (!practiceId || contextRef.current.practiceId === practiceId) return;
    applyPatientContext({ ...contextRef.current, practiceId });
  }, [practiceSession?.practice?.id, applyPatientContext]);

  useEffect(() => {
    if (!autoSend || !initialPrompt || !user) return;
    void sendMessage(initialPrompt);
    clearSessionPrompt();
  }, [autoSend, initialPrompt, user, sendMessage, clearSessionPrompt]);

  const onResolveDraft = async (
    draft: DoctorAgentDraft,
    decision: 'approved' | 'rejected',
  ) => {
    const resolved = await resolveDoctorDraft(draft.id, decision);
    const draftType = resolved.type ?? draft.type;
    if (decision === 'approved' && draftType) {
      notifyDraftApproved({
        draftId: draft.id,
        type: draftType,
        preview: resolved.preview ?? draft.preview ?? '',
        payload: resolved.payload ?? draft.payload ?? {},
        patientId: resolved.patientId ?? draft.patientId ?? null,
        appointmentId:
          (resolved.appointmentId as string | null | undefined) ??
          (draft as { appointmentId?: string }).appointmentId ??
          null,
      });
      if (draftType === 'message_reply' && resolved.sent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-sys`,
            role: 'assistant',
            content: 'Message sent to the patient.',
            time: formatTime(),
          },
        ]);
      }

      if (draftType === 'clinical_report') {
        const apptId =
          resolved.appointmentId ??
          draft.appointmentId ??
          contextRef.current.appointmentId ??
          null;
        if (apptId) {
          persistClinicalReportDraftForAppointment(
            String(apptId),
            (resolved.payload ?? draft.payload ?? {}) as Record<string, unknown>,
          );
        }
        const returnPath = contextRef.current.returnPath;
        if (returnPath) {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-report`,
              role: 'assistant',
              content:
                'H&P report draft applied. Taking you back to post-consult to review each section before saving.',
              time: formatTime(),
            },
          ]);
          navigate(returnPath);
        }
      }
    }
    await loadDrafts();
  };

  const onPrepareNext = () => {
    const next = snapshot.nextAppointment;
    if (next?.patientId) {
      applyPatientContext({
        patientId: next.patientId,
        patientName: next.patientName,
        appointmentId: next.id,
      });
    }
    void sendMessage(
      'Prepare me for my next patient. Use prepare-next-patient. Give a pre-visit brief with sources. If nobody is scheduled, say so.',
      { displayText: 'Prepare next patient' },
    );
  };

  const handleFileUpload = useCallback(
    (upload: AyahFileUpload) => {
      lastFileUploadRef.current = upload;
    },
    [],
  );

  const appendLocalExchange = useCallback(
    (exchange: { userContent?: string; assistantContent: string; hideUser?: boolean }) => {
      const stamp = formatTime();
      setMessages((prev) => [
        ...prev,
        ...(exchange.hideUser || !exchange.userContent
          ? []
          : [
              {
                id: `${Date.now()}-u`,
                role: 'user' as const,
                content: exchange.userContent,
                time: stamp,
              },
            ]),
        {
          id: `${Date.now()}-a`,
          role: 'assistant',
          content: formatAyahReply(exchange.assistantContent),
          time: stamp,
        },
      ]);
      setInput('');
    },
    [setMessages],
  );

  const onConfirmUnichart = useCallback(async () => {
    const preview = pendingUnichartRef.current;
    if (!preview?.previewId) return;
    try {
      const result = await djangoApplyUnichart(preview.previewId);
      const filled = (result.filled ?? []).join(', ') || 'nothing new';
      appendLocalExchange({
        assistantContent:
          result.status === 'already_applied'
            ? 'This chart was already applied.'
            : `Chart import applied. Updated: ${filled}.`,
        hideUser: true,
      });
      setPendingUnichart(null);
    } catch (err) {
      appendLocalExchange({
        assistantContent: `❌ Could not apply chart: ${err instanceof Error ? err.message : 'Unknown error'}`,
        hideUser: true,
      });
    }
  }, [appendLocalExchange]);

  const handleSendWithFile = useCallback(
    async (text: string) => {
      const upload = lastFileUploadRef.current;
      lastFileUploadRef.current = null;

      if (!upload) {
        if (
          pendingUnichartRef.current?.previewId &&
          pendingUnichartRef.current.status === 'matched' &&
          wantsUnichartApply(text)
        ) {
          void onConfirmUnichart();
          return;
        }
        void sendMessage(text);
        return;
      }

      if (!user || !practiceSnapshotRef.current) {
        void sendMessage(text || 'File uploaded but no practice context found.');
        return;
      }

      const practiceId = contextRef.current.practiceId || (practiceSnapshotRef.current as Record<string, unknown>)?.practiceId as string || '';

      if (upload.type === 'chart_pdf') {
        const userLabel = text.trim()
          ? `${text.trim()}\n📎 ${upload.file.name}`
          : `📎 ${upload.file.name}`;
        const assistantId = `${Date.now()}-a`;
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-u`,
            role: 'user',
            content: userLabel,
            time: formatTime(),
          },
          {
            id: assistantId,
            role: 'assistant',
            content: formatAyahReply(`Reading UniCharts PDF **${upload.file.name}**…`),
            time: formatTime(),
          },
        ]);
        setInput('');

        try {
          const preview = await djangoPreviewUnichart(upload.file, {
            practiceId:
              contextRef.current.practiceId ||
              (practiceSnapshotRef.current as { practiceId?: string }).practiceId,
          });
          setPendingUnichart(preview.status === 'matched' ? preview : null);
          let reply: string;
          if (preview.status === 'matched' && preview.patient) {
            const fields =
              preview.fills.length > 0
                ? preview.fills.join(', ')
                : 'no empty fields to fill';
            reply = `**${preview.patient.displayName}** matched from this chart. I can fill empty fields only: ${fields}.\n\nUse **Confirm chart import** below to apply, or ask me anything about this preview.`;
          } else if (preview.status === 'already_applied') {
            reply = 'This chart was already applied to the patient record.';
          } else {
            reply =
              'I could not match this PDF to a patient in your practice. Check the chart belongs to someone on your panel, then try again or pick the patient first.';
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: formatAyahReply(reply) } : m,
            ),
          );
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'Unknown error';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: formatAyahReply(
                      `❌ Chart preview failed: ${detail}\n\nThis step uses the Django API (\`/api/v1/patients/unichart/preview/\`). Check that the backend is running.`,
                    ),
                  }
                : m,
            ),
          );
        }
        return;
      }

      if (upload.type === 'patient_csv') {
        const parsed = parsePatientBulkCsv(upload.content);
        if (parsed.rows.length === 0) {
          void sendMessage(
            text || `I tried to parse "${upload.file.name}" but found no valid patient rows. ${parsed.issues.map((i) => `Line ${i.line}: ${i.message}`).join('; ')}`,
          );
          return;
        }

        const issuesSummary = parsed.issues.length
          ? `\n⚠️ ${parsed.issues.length} row(s) skipped: ${parsed.issues.slice(0, 3).map((i) => `Line ${i.line}: ${i.message}`).join('; ')}`
          : '';

        void sendMessage(
          `Importing ${parsed.rows.length} patients from "${upload.file.name}"…` + issuesSummary,
          { displayText: `📎 ${upload.file.name}, ${parsed.rows.length} patients` },
        );

        try {
          const results = await importPracticePatientsBulk({
            doctorId: user.id,
            practiceId,
            rows: parsed.rows,
            sendAppInvites: true,
          });
          const imported = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success);
          const needsActivation = results.filter((r) => r.success && r.activationCode);

          let reply = `✅ **${imported} patient${imported !== 1 ? 's' : ''} imported** from ${upload.file.name}.`;
          if (failed.length) {
            reply += `\n❌ ${failed.length} failed: ${failed.slice(0, 3).map((f) => `${f.displayName}: ${f.error}`).join('; ')}`;
          }
          if (needsActivation.length) {
            const clinicCode = needsActivation[0]?.activationCode;
            reply += `\n\nPatients activate in the Anixi app with clinic code \`${clinicCode}\`. They tap Activate clinic account, enter that code, and confirm their details.`;
          }
          void sendMessage(reply, { hideUser: true });
        } catch (err) {
          void sendMessage(
            `❌ Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            { hideUser: true },
          );
        }
        return;
      }

      if (upload.type === 'staff_csv') {
        const parsed = parseDoctorBulkCsv(upload.content);
        if (parsed.rows.length === 0) {
          void sendMessage(
            text || `I tried to parse "${upload.file.name}" but found no valid staff rows. ${parsed.issues.map((i) => `Line ${i.line}: ${i.message}`).join('; ')}`,
          );
          return;
        }

        void sendMessage(
          `Sending invites to ${parsed.rows.length} staff from "${upload.file.name}"…`,
          { displayText: `📎 ${upload.file.name}, ${parsed.rows.length} staff` },
        );

        try {
          const practiceName = (practiceSnapshotRef.current as Record<string, unknown>)?.name as string || '';
          const results = await createPracticeInvitesBulk(
            { practiceId, practiceName, invitedBy: user.id, invitedByName: user.displayName || 'Clinic admin' },
            parsed.rows,
          );
          const sent = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success);

          let reply = `✅ **${sent} invitation${sent !== 1 ? 's' : ''} sent** from ${upload.file.name}.`;
          if (failed.length) {
            reply += `\n❌ ${failed.length} failed: ${failed.slice(0, 3).map((f) => `${f.email}: ${f.error}`).join('; ')}`;
          }
          void sendMessage(reply, { hideUser: true });
        } catch (err) {
          void sendMessage(
            `❌ Staff import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            { hideUser: true },
          );
        }
        return;
      }

      // Unknown file type, let Ayah process it
      void sendMessage(
        text || `I uploaded a file: "${upload.file.name}". It doesn't look like a patient roster or staff CSV I can auto-import. Let me know what you'd like to do with it.`,
        { displayText: `📎 ${upload.file.name}` },
      );
    },
    [user, sendMessage, onConfirmUnichart, setMessages],
  );

  const onAttention = (item: AttentionItem) => {
    if (item.patientId) {
      applyPatientContext({
        patientId: item.patientId,
        patientName: item.patientName,
        appointmentId: item.appointmentId,
      });
    }
    void sendMessage(item.prompt, {
      displayText: item.title,
      context: item.patientId
        ? {
            patientId: item.patientId,
            patientName: item.patientName,
            appointmentId: item.appointmentId,
          }
        : contextRef.current,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8faf8] lg:flex-row">
      {showAIDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">AI Companion Disclaimer</h3>
                <button
                  onClick={() => setShowAIDisclaimer(false)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mb-6 space-y-3 text-sm text-gray-600">
              <p>
                <strong>Ayah</strong> is an AI clinical assistant designed to help with administrative
                tasks, documentation, and clinical support.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Ayah provides suggestions and assistance but does not replace professional
                  medical judgment
                </li>
                <li>
                  Always verify AI-generated information before making clinical decisions
                </li>
                <li>
                  Do not enter sensitive patient information you are not authorised to process
                </li>
                <li>
                  AI interactions may be logged for quality improvement and safety monitoring
                </li>
                <li>
                  Some features may use third-party AI providers under our instructions
                </li>
              </ul>
              <p className="text-xs text-gray-500">
                By using Ayah, you acknowledge these limitations and agree to use it responsibly
                in accordance with POPIA and professional standards.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAcceptAIDisclaimer}
                className="flex-1 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                I Understand and Accept
              </button>
              <button
                onClick={() => setShowAIDisclaimer(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <AyahCommandBoard
        greeting={greeting}
        firstName={firstName}
        snapshot={snapshot}
        pendingDrafts={pendingDrafts}
        briefingLoading={briefingLoading}
        onPrepareNext={onPrepareNext}
        onAttention={onAttention}
        onAskPanel={() => {
          const panel = PRACTICE_COMMANDS.find((command) => command.id === 'panel');
          if (panel) runCommand(panel);
        }}
        onResolveDraft={(draft, decision) => void onResolveDraft(draft, decision)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-[#e1e7ef] bg-white px-4 py-3 lg:hidden shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
          {greeting}, {clinicianHeaderLabel(user?.displayName)}
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          <span className="rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-medium text-[#427160]">
            {snapshot.todayAppointments.length} today
          </span>
          <span className="rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-medium text-[#427160]">
            {snapshot.pendingAppointments} pending
          </span>
          {snapshot.nextAppointment ? (
            <button
              type="button"
              onClick={onPrepareNext}
              className="rounded-full bg-[#427160] px-3 py-1 text-xs font-semibold text-white"
            >
              Prepare {snapshot.nextAppointment.patientName || 'next'}
            </button>
          ) : null}
        </div>
      </div>

      <AyahWorkspace
        context={context}
        messages={messages}
        streaming={streaming}
        hydrated={hydrated}
        input={input}
        onInputChange={setInput}
        onSend={(text) => void handleSendWithFile(text)}
        onCommand={runCommand}
        onClearPatient={() => applyPatientContext({})}
        onNewConversation={() =>
          resetToWelcome({
            displayName: user?.displayName,
            patientName: context.patientName,
          })
        }
        onFileUpload={handleFileUpload}
        pendingDrafts={pendingDrafts}
        onResolveDraft={(draft, decision) => void onResolveDraft(draft, decision)}
        scrollRef={scrollRef}
        onVoiceMode={() => {
          setVoiceModeOpen(true);
          void voiceConversation.startConversation();
        }}
        pendingUnichart={pendingUnichart}
        onConfirmUnichart={() => void onConfirmUnichart()}
        onDismissUnichart={() => setPendingUnichart(null)}
      />
      </div>

      <AyahVoicePanel
        open={voiceModeOpen}
        phase={voiceConversation.phase}
        error={voiceConversation.error}
        lastTranscript={voiceConversation.lastTranscript}
        lastReply={voiceConversation.lastReply}
        partialReply={voiceConversation.partialReply}
        onClose={() => {
          setVoiceModeOpen(false);
          void voiceConversation.stopConversation();
        }}
        onToggleListening={() => void voiceConversation.toggleListening()}
      />
    </div>
  );
};

export default AyahPage;
