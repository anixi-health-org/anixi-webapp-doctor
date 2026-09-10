import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  parseDoctorBulkCsv,
  createPracticeInvitesBulk,
} from '../services/bulkInviteService';

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const AyahPage: React.FC = () => {
  const { user } = useAuth();
  const { context, initialPrompt, autoSend, notifyDraftApproved, clearSessionPrompt, setContext } =
    useAskAnixi();
  const { loading: briefingLoading, snapshot, practiceSnapshot } =
    useDoctorBriefingData();
  const practiceSnapshotRef = useRef(practiceSnapshot);
  practiceSnapshotRef.current = practiceSnapshot;
  const patientChart = useAyahPatientChart(user?.id, context.patientId);
  const patientChartRef = useRef(patientChart);
  patientChartRef.current = patientChart;
  const { messages, hydrated, setMessages, markBriefingBootstrapped } =
    useAyahChat();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<DoctorAgentDraft[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFileUploadRef = useRef<AyahFileUpload | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const firstName = user?.displayName?.split(' ')[0] || 'Doctor';
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

  useEffect(scrollToBottom, [messages, streaming]);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: { hideUser?: boolean; context?: AskAnixiContext; displayText?: string },
    ) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || !user) return;

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
      const clinicDate = new Date().toLocaleDateString('en-CA', {
        timeZone: clinicTimezone,
      });
      const requestContext = {
        ...nextContext,
        practiceSnapshot: practiceSnapshotRef.current as unknown as Record<string, unknown>,
        patientSnapshot: chart as unknown as Record<string, unknown> | undefined,
        clinicDate,
        clinicTimezone,
      };
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
          message: trimmed,
          context: requestContext,
          threadId: requestContext.patientId
            ? `${user.id}:${requestContext.patientId}`
            : user.id,
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
    [streaming, user, loadDrafts, setMessages],
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
    if (!autoSend || !initialPrompt || !user) return;
    void sendMessage(initialPrompt);
    clearSessionPrompt();
  }, [autoSend, initialPrompt, user, sendMessage, clearSessionPrompt]);

  useEffect(() => {
    if (hydrated) markBriefingBootstrapped();
  }, [hydrated, markBriefingBootstrapped]);

  const onResolveDraft = async (
    draft: DoctorAgentDraft,
    decision: 'approved' | 'rejected',
  ) => {
    const resolved = await resolveDoctorDraft(draft.id, decision);
    if (decision === 'approved' && resolved.type) {
      notifyDraftApproved({
        draftId: draft.id,
        type: resolved.type,
        preview: resolved.preview ?? draft.preview ?? '',
        payload: resolved.payload ?? draft.payload ?? {},
        patientId: resolved.patientId ?? draft.patientId ?? null,
        appointmentId:
          (resolved.appointmentId as string | null | undefined) ??
          (draft as { appointmentId?: string }).appointmentId ??
          null,
      });
      if (resolved.type === 'message_reply' && (resolved as { sent?: boolean }).sent) {
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

  const handleSendWithFile = useCallback(
    async (text: string) => {
      const upload = lastFileUploadRef.current;
      lastFileUploadRef.current = null;

      if (!upload) {
        void sendMessage(text);
        return;
      }

      if (!user || !practiceSnapshotRef.current) {
        void sendMessage(text || 'File uploaded but no practice context found.');
        return;
      }

      const practiceId = contextRef.current.practiceId || (practiceSnapshotRef.current as Record<string, unknown>)?.practiceId as string || '';

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
            const codesPreview = needsActivation
              .slice(0, 5)
              .map((r) => `${r.displayName}: \`${r.activationCode}\``)
              .join('\n');
            reply += `\n\n📱 **${needsActivation.length} activation code${needsActivation.length !== 1 ? 's' : ''}** — patients should choose "Activate clinic account" in the app:\n${codesPreview}`;
            if (needsActivation.length > 5) {
              reply += `\n…and ${needsActivation.length - 5} more (see clinic setup import results).`;
            }
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
    [user, sendMessage],
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f6f3] lg:flex-row">
      <div className="hidden h-full lg:flex">
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
      </div>

      <div className="border-b border-[#e1e7ef] bg-white px-4 py-3 lg:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
          {greeting}, Dr. {firstName}
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
        onNewConversation={() => setMessages([])}
        onFileUpload={handleFileUpload}
        pendingDrafts={pendingDrafts}
        onResolveDraft={(draft, decision) => void onResolveDraft(draft, decision)}
        scrollRef={scrollRef}
      />
    </div>
  );
};

export default AyahPage;
