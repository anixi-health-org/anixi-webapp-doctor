import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AyahWorkspace, type AyahFileUpload } from '../../components/ayah/AyahWorkspace';
import { ClinicAyahCommandBoard } from '../../components/clinic/ClinicAyahCommandBoard';
import { useAskAnixi } from '../../context/AskAnixiContext';
import { useAuth } from '../../hooks/AuthContext';
import { buildAyahClinicWelcomeMessage } from '../../lib/ayahClinicWelcome';
import {
  CLINIC_ADMIN_COMMANDS,
  commandNeedsPatient,
  type AyahCommand,
} from '../../lib/ayahCommands';
import { ayahDoctorGreeting } from '../../lib/ayahDoctorWelcome';
import {
  loadClinicAyahChat,
  saveClinicAyahChat,
  type StoredAyahMessage,
} from '../../lib/ayahChatStorage';
import { formatAyahReply } from '../../lib/formatAyahReply';
import {
  formatAskAnixiError,
  streamAskAnixi,
  type AskAnixiContext,
} from '../../services/askAnixiService';
import {
  parsePatientBulkCsv,
  importPracticePatientsBulk,
} from '../../services/bulkPatientImportService';
import {
  parseDoctorBulkCsv,
  createPracticeInvitesBulk,
} from '../../services/bulkInviteService';
import {
  djangoApplyUnichart,
  djangoPreviewUnichart,
  type UnichartPreview,
} from '../../services/djangoApiService';
import { formatUnichartBatchApplySummary } from '../../lib/unichartBatchApplySummary';
import {
  formatUnichartImportJobSummary,
  pollUnichartImportJob,
  startUnichartPdfImport,
} from '../../lib/unichartPdfImportJob';
import {
  clinicImportAgentSuffix,
  clinicImportFollowUpPrompt,
  clinicImportSessionFromRefs,
  mergeClinicImportSession,
  unichartAgentContextSuffix,
  wantsUnichartApply,
} from '../../lib/ayahUnichartContext';
import {
  formatUnichartBatchImportFailure,
  formatUnichartPreviewFailure,
  shouldUseUnichartBatchApply,
  userExpectsAttachedDocument,
} from '../../lib/unichartUploadIntent';
import {
  buildClinicOpsPracticeSnapshot,
  mergeCompanionRequestContext,
  resolveAyahThreadId,
  resolveClinicAnchors,
} from '../../lib/buildCompanionContext';
import {
  getPracticeDashboardStats,
  type PracticeDashboardStats,
} from '../../services/practiceDashboardService';

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function ClinicAyahPage() {
  const { user, practiceSession } = useAuth();
  const { context, setContext } = useAskAnixi();

  const [messages, setMessages] = useState<StoredAyahMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showAIDisclaimer, setShowAIDisclaimer] = useState(false);
  const [aiDisclaimerAccepted, setAIDisclaimerAccepted] = useState(false);
  const [pendingUnichart, setPendingUnichart] = useState<UnichartPreview | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFileUploadRef = useRef<AyahFileUpload | null>(null);
  const lastRosterFileRef = useRef<File | null>(null);
  const lastImportJobIdRef = useRef<string | null>(null);
  const lastUnichartImportSummaryRef = useRef<string | null>(null);
  const lastUnichartBatchAppliedRef = useRef<number | null>(null);
  const lastUnichartBatchTotalRef = useRef<number | null>(null);
  const pendingUnichartRef = useRef<UnichartPreview | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    pendingUnichartRef.current = pendingUnichart;
  }, [pendingUnichart]);

  const [clinicStats, setClinicStats] = useState<PracticeDashboardStats | null>(null);

  const practiceTimezone =
    practiceSession?.practice?.timezone?.trim() || 'Africa/Johannesburg';

  const practiceSnapshot = useMemo(
    () =>
      buildClinicOpsPracticeSnapshot({
        practiceId: practiceSession?.practice?.id,
        name: practiceSession?.practice?.name,
        timezone: practiceTimezone,
        stats: clinicStats,
      }),
    [
      practiceSession?.practice?.id,
      practiceSession?.practice?.name,
      practiceTimezone,
      clinicStats,
    ],
  );
  const practiceSnapshotRef = useRef(practiceSnapshot);
  practiceSnapshotRef.current = practiceSnapshot;

  useEffect(() => {
    const practiceId = practiceSession?.practice?.id;
    if (!practiceId) {
      setClinicStats(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stats = await getPracticeDashboardStats(practiceId);
        if (!cancelled) setClinicStats(stats);
      } catch {
        if (!cancelled) setClinicStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceSession?.practice?.id]);

  const firstName = user?.displayName?.trim().split(/\s+/)[0] || 'Admin';
  const greeting = ayahDoctorGreeting();

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      setHydrated(false);
      return;
    }
    const loaded = loadClinicAyahChat(user.id);
    const welcome = buildAyahClinicWelcomeMessage({ displayName: user.displayName });
    setMessages(loaded.length === 0 ? [welcome] : loaded);
    setHydrated(true);
  }, [user?.id, user?.displayName]);

  useEffect(() => {
    if (!user?.id || !hydrated) return;
    saveClinicAyahChat(user.id, messages);
  }, [messages, user?.id, hydrated]);

  useEffect(() => {
    const practiceId = practiceSession?.practice?.id;
    if (!practiceId || contextRef.current.practiceId === practiceId) return;
    const next = { ...contextRef.current, practiceId };
    setContext(next);
    contextRef.current = next;
  }, [practiceSession?.practice?.id, setContext]);

  useEffect(() => {
    const hasAccepted = localStorage.getItem('ayah_clinic_ai_disclaimer_accepted');
    if (hasAccepted) {
      setAIDisclaimerAccepted(true);
    } else {
      setShowAIDisclaimer(true);
    }
  }, []);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  useEffect(scrollToBottom, [messages, streaming]);

  const handleAcceptAIDisclaimer = () => {
    localStorage.setItem('ayah_clinic_ai_disclaimer_accepted', 'true');
    setAIDisclaimerAccepted(true);
    setShowAIDisclaimer(false);
  };

  const appendLocalExchange = useCallback(
    (exchange: {
      userContent?: string;
      assistantContent: string;
      hideUser?: boolean;
    }) => {
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
    [],
  );

  const commitClinicImportSession = useCallback(
    (payload: {
      summary: string;
      jobId?: string | null;
      applied?: number;
      total?: number;
    }) => {
      lastUnichartImportSummaryRef.current = payload.summary;
      if (payload.jobId) {
        lastImportJobIdRef.current = payload.jobId;
      }
      if (payload.applied != null) {
        lastUnichartBatchAppliedRef.current = payload.applied;
      }
      if (payload.total != null) {
        lastUnichartBatchTotalRef.current = payload.total;
      }
      setContext(
        mergeClinicImportSession(
          contextRef.current,
          clinicImportSessionFromRefs({
            jobId: lastImportJobIdRef.current,
            summary: lastUnichartImportSummaryRef.current,
            applied: lastUnichartBatchAppliedRef.current,
            total: lastUnichartBatchTotalRef.current,
          }),
        ),
      );
    },
    [setContext],
  );

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

      const preview = pendingUnichartRef.current;
      const sessionFields = clinicImportSessionFromRefs({
        jobId: lastImportJobIdRef.current,
        summary: lastUnichartImportSummaryRef.current,
        applied: lastUnichartBatchAppliedRef.current,
        total: lastUnichartBatchTotalRef.current,
      });
      const nextContext = mergeClinicImportSession(
        { ...contextRef.current, ...(options?.context ?? {}) },
        sessionFields,
      );
      const agentText = `${trimmed}${unichartAgentContextSuffix(preview)}${clinicImportAgentSuffix(nextContext)}`;
      const anchors = resolveClinicAnchors(practiceTimezone);
      const requestContext = mergeCompanionRequestContext(nextContext, {
        practiceId:
          nextContext.practiceId ||
          (practiceSnapshotRef.current.practiceId as string | undefined),
        practiceSnapshot: practiceSnapshotRef.current,
        unichartPreview: preview,
        clientSurface: 'clinic-ayah',
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
          agentId: 'clinic-admin',
          message: agentText,
          context: requestContext,
          threadId: resolveAyahThreadId({
            surface: 'clinic-ayah',
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
                    'I finished looking, but had nothing to add. Try a quick action or ask again.',
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
      }
    },
    [streaming, user, aiDisclaimerAccepted, practiceTimezone],
  );

  const runCommand = useCallback(
    (command: AyahCommand) => {
      if (commandNeedsPatient(command, contextRef.current)) {
        void sendMessage(
          `${command.prompt} No patient is in context. Tell me which patient if you need chart-specific help.`,
          { displayText: command.label },
        );
        return;
      }
      void sendMessage(command.prompt, { displayText: command.label });
    },
    [sendMessage],
  );

  const handleFileUpload = useCallback((upload: AyahFileUpload) => {
    lastFileUploadRef.current = upload;
    if (upload.type === 'chart_pdf') {
      lastRosterFileRef.current = upload.file;
    }
  }, []);

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
        if (userExpectsAttachedDocument(text) && lastUnichartImportSummaryRef.current) {
          void sendMessage(text);
          return;
        }
        const practiceIdForRetry = String(
          contextRef.current.practiceId ||
            practiceSnapshotRef.current.practiceId ||
            practiceSession?.practice?.id ||
            '',
        );
        if (
          user &&
          practiceIdForRetry &&
          lastRosterFileRef.current &&
          (shouldUseUnichartBatchApply(
            lastRosterFileRef.current.name,
            text,
            lastRosterFileRef.current.size,
          ) ||
            userExpectsAttachedDocument(text))
        ) {
          const file = lastRosterFileRef.current;
          void (async () => {
            const userLabel = text.trim()
              ? `${text.trim()}\n📎 ${file.name}`
              : `📎 ${file.name}`;
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
                content: formatAyahReply(
                  `Reading **${file.name}** and backfilling matched patient records…`,
                ),
                time: formatTime(),
              },
            ]);
            try {
              const started = await startUnichartPdfImport(file, practiceIdForRetry);
              let reply: string;
              let applied = 0;
              let totalCharts = 0;
              if (started.async && started.jobId) {
                lastImportJobIdRef.current = started.jobId;
                const job = await pollUnichartImportJob(started.jobId, (progress) => {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: formatAyahReply(
                              progress.totalRows > 0
                                ? `UniCharts import **${file.name}**… ${progress.processedRows}/${progress.totalRows} charts (${progress.importedCount} updated or created).`
                                : `Extracting text from **${file.name}**…`,
                            ),
                          }
                        : m,
                    ),
                  );
                });
                reply = formatUnichartImportJobSummary(job, file.name);
                applied = job.importedCount;
                totalCharts = job.processedRows;
              } else if (started.summary) {
                reply = formatUnichartBatchApplySummary(started.summary, file.name);
                applied =
                  (started.summary.applied ?? 0) + (started.summary.created ?? 0);
                totalCharts = started.summary.totalCharts;
              } else {
                reply = 'UniCharts import finished.';
              }
              commitClinicImportSession({
                summary: reply,
                jobId: lastImportJobIdRef.current,
                applied,
                total: totalCharts,
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: formatAyahReply(reply) } : m,
                ),
              );
              void sendMessage(clinicImportFollowUpPrompt(file.name, reply), {
                hideUser: true,
              });
            } catch (err) {
              const detail = err instanceof Error ? err.message : 'Unknown error';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: formatAyahReply(formatUnichartBatchImportFailure(detail)),
                      }
                    : m,
                ),
              );
            }
          })();
          return;
        }
        void sendMessage(text);
        return;
      }

      if (!user) {
        void sendMessage(text || 'File uploaded but session expired.');
        return;
      }

      const practiceId = String(
        contextRef.current.practiceId ||
          practiceSnapshotRef.current.practiceId ||
          practiceSession?.practice?.id ||
          '',
      );

      if (upload.type === 'chart_pdf') {
        if (shouldUseUnichartBatchApply(upload.file.name, text, upload.file.size)) {
          const file = upload.file;
          if (!practiceId) {
            appendLocalExchange({
              assistantContent:
                '❌ No clinic is selected. Open Ayah from your practice dashboard and try again.',
              hideUser: true,
            });
            return;
          }
          const userLabel = text.trim()
            ? `${text.trim()}\n📎 ${file.name}`
            : `📎 ${file.name}`;
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
              content: formatAyahReply(
                `Reading **${file.name}** and backfilling matched patient records…`,
              ),
              time: formatTime(),
            },
          ]);
          setInput('');

          try {
            const started = await startUnichartPdfImport(file, practiceId);
            let reply: string;
            let applied = 0;
            let totalCharts = 0;
            if (started.async && started.jobId) {
              lastImportJobIdRef.current = started.jobId;
              const job = await pollUnichartImportJob(started.jobId, (progress) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: formatAyahReply(
                            progress.totalRows > 0
                              ? `UniCharts import **${file.name}**… ${progress.processedRows}/${progress.totalRows} charts (${progress.importedCount} updated or created).`
                              : `Extracting text from **${file.name}**…`,
                          ),
                        }
                      : m,
                  ),
                );
              });
              reply = formatUnichartImportJobSummary(job, file.name);
              applied = job.importedCount;
              totalCharts = job.processedRows;
            } else if (started.summary) {
              reply = formatUnichartBatchApplySummary(started.summary, file.name);
              applied = (started.summary.applied ?? 0) + (started.summary.created ?? 0);
              totalCharts = started.summary.totalCharts;
            } else {
              reply = 'UniCharts import finished.';
            }
            setPendingUnichart(null);
            commitClinicImportSession({
              summary: reply,
              jobId: lastImportJobIdRef.current,
              applied,
              total: totalCharts,
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: formatAyahReply(reply) } : m,
              ),
            );
            void sendMessage(clinicImportFollowUpPrompt(file.name, reply), {
              hideUser: true,
            });
          } catch (err) {
            const detail = err instanceof Error ? err.message : 'Unknown error';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: formatAyahReply(formatUnichartBatchImportFailure(detail)),
                    }
                  : m,
              ),
            );
          }
          return;
        }

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
              (practiceSnapshotRef.current.practiceId as string | undefined) ||
              practiceSession?.practice?.id,
            client: 'doctor-web',
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
              'I could not match this PDF to a patient on your roster. Check the chart belongs to someone in this clinic, then try again.';
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
                    content: formatAyahReply(formatUnichartPreviewFailure(detail)),
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
            text ||
              `I tried to parse "${upload.file.name}" but found no valid patient rows. ${parsed.issues.map((i) => `Line ${i.line}: ${i.message}`).join('; ')}`,
          );
          return;
        }

        void sendMessage(
          `Importing ${parsed.rows.length} patients from "${upload.file.name}"…`,
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
          let reply = `✅ **${imported} patient${imported !== 1 ? 's' : ''} imported** from ${upload.file.name}.`;
          if (failed.length) {
            reply += `\n❌ ${failed.length} failed: ${failed.slice(0, 3).map((f) => `${f.displayName}: ${f.error}`).join('; ')}`;
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
            text ||
              `I tried to parse "${upload.file.name}" but found no valid staff rows. ${parsed.issues.map((i) => `Line ${i.line}: ${i.message}`).join('; ')}`,
          );
          return;
        }

        void sendMessage(
          `Sending invites to ${parsed.rows.length} staff from "${upload.file.name}"…`,
          { displayText: `📎 ${upload.file.name}, ${parsed.rows.length} staff` },
        );

        try {
          const practiceName = String(practiceSnapshotRef.current.name ?? '');
          const results = await createPracticeInvitesBulk(
            {
              practiceId,
              practiceName,
              invitedBy: user.id,
              invitedByName: user.displayName || 'Clinic admin',
            },
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

      void sendMessage(
        text ||
          `I uploaded "${upload.file.name}". Attach a UniCharts PDF, patient roster CSV, or staff CSV, or tell me what you need.`,
        { displayText: `📎 ${upload.file.name}` },
      );
    },
    [
      user,
      sendMessage,
      onConfirmUnichart,
      commitClinicImportSession,
      practiceSession?.practice?.id,
      appendLocalExchange,
    ],
  );

  const resetToWelcome = useCallback(() => {
    setMessages([buildAyahClinicWelcomeMessage({ displayName: user?.displayName })]);
    setPendingUnichart(null);
  }, [user?.displayName]);

  const setupCommand = CLINIC_ADMIN_COMMANDS.find((c) => c.id === 'practice-setup');
  const rosterCommand = CLINIC_ADMIN_COMMANDS.find((c) => c.id === 'panel');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8faf8] lg:flex-row">
      {showAIDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative mx-4 max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">AI Companion Disclaimer</h3>
                <button
                  type="button"
                  onClick={() => setShowAIDisclaimer(false)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mb-6 space-y-3 text-sm text-gray-600">
              <p>
                <strong>Ayah</strong> helps with clinic operations and chart imports. Clinical
                decisions stay with your licensed clinicians.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Verify AI suggestions before acting on patient data</li>
                <li>Chart import fills empty fields only after you confirm</li>
                <li>Interactions may be logged for safety and quality</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAcceptAIDisclaimer}
                className="flex-1 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                I Understand and Accept
              </button>
              <button
                type="button"
                onClick={() => setShowAIDisclaimer(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ClinicAyahCommandBoard
        greeting={greeting}
        firstName={firstName}
        practiceId={practiceSession?.practice?.id}
        onAskSetup={() => setupCommand && runCommand(setupCommand)}
        onAskRoster={() => rosterCommand && runCommand(rosterCommand)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-[#e1e7ef] bg-white px-4 py-3 lg:hidden shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
            {greeting}, {firstName}
          </p>
        </div>

        <AyahWorkspace
          commandScope="clinic"
          context={context}
          messages={messages}
          streaming={streaming}
          hydrated={hydrated}
          input={input}
          onInputChange={setInput}
          onSend={(text) => void handleSendWithFile(text)}
          onCommand={runCommand}
          onClearPatient={() => setContext({ ...contextRef.current, patientId: undefined, patientName: undefined })}
          onNewConversation={resetToWelcome}
          onFileUpload={handleFileUpload}
          scrollRef={scrollRef}
          pendingUnichart={pendingUnichart}
          onConfirmUnichart={() => void onConfirmUnichart()}
          onDismissUnichart={() => setPendingUnichart(null)}
        />
      </div>
    </div>
  );
}
