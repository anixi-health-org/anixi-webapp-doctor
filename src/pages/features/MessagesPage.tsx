import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { PageHeaderSkeleton, Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorPatients } from '../../services/patientManagementService';
import {
  ChatMessage,
  Conversation,
  conversationIdFor,
  getOrCreateConversation,
  listenToConversationMessages,
  listenToDoctorConversations,
  markConversationRead,
  otherParticipantId,
  sendConversationMessage,
} from '../../services/conversationService';
import { Patient } from '../../types';

type InboxRow = {
  key: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  preview: string;
  updatedAt: Date;
  unread: number;
  conversationId: string | null;
  pingedYou: boolean;
};

const resolvePatientLabel = (
  patient: Patient | undefined,
  conversationName?: string
): string => {
  const candidates = [
    patient?.displayName,
    conversationName,
    patient?.email?.includes('@') ? patient.email.split('@')[0] : undefined,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.toLowerCase() !== 'patient') return trimmed;
  }
  return patient?.email || conversationName?.trim() || 'Patient';
};

const MessagesSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <div className="grid h-[560px] overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white lg:grid-cols-[300px_1fr]">
      <div className="border-b border-[#eef2f6] p-4 lg:border-b-0 lg:border-r">
        <Skeleton className="mb-3 h-10 w-full rounded-[10px]" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-16 w-3/4 rounded-[12px]" />
          <Skeleton className="ml-auto h-16 w-2/3 rounded-[12px]" />
        </div>
        <Skeleton className="mt-4 h-11 w-full rounded-[10px]" />
      </div>
    </div>
  </>
);

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const doctorId = user?.id;
  const doctorName = user?.displayName || 'Doctor';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doctorId) return;
    let cancelled = false;
    getDoctorPatients(doctorId)
      .then((list) => {
        if (!cancelled) setPatients(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load patients');
        }
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId) return;
    const unsub = listenToDoctorConversations(
      doctorId,
      (next) => {
        setConversations(next);
        setError(null);
        setIsBootstrapping(false);
      },
      (err) => setError(err.message)
    );
    return unsub;
  }, [doctorId]);

  const inboxRows = useMemo(() => {
    if (!doctorId) return [] as InboxRow[];

    const rows: InboxRow[] = [];

    conversations.forEach((conversation) => {
      // Only show threads that actually have messages
      if (!conversation.lastMessage?.text?.trim()) return;

      const patientId = otherParticipantId(conversation, doctorId);
      if (!patientId) return;
      const patient = patients.find((p) => p.id === patientId);
      const participantName = resolvePatientLabel(
        patient,
        conversation.participants?.[patientId]?.displayName
      );
      const unread = conversation.unread?.[doctorId] || 0;
      const fromPatient = conversation.lastMessage.senderId === patientId;

      rows.push({
        key: conversation.id,
        patientId,
        patientName: participantName,
        patientEmail: patient?.email,
        preview: conversation.lastMessage.text,
        updatedAt: conversation.updatedAt || conversation.lastMessage.createdAt || new Date(0),
        unread,
        conversationId: conversation.id,
        pingedYou: fromPatient && unread > 0,
      });
    });

    const q = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (!q) return true;
        return (
          row.patientName.toLowerCase().includes(q) ||
          (row.patientEmail || '').toLowerCase().includes(q) ||
          row.preview.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
  }, [conversations, patients, doctorId, search]);

  useEffect(() => {
    if (selectedPatientId && !inboxRows.some((r) => r.patientId === selectedPatientId)) {
      setSelectedPatientId(null);
    }
  }, [inboxRows, selectedPatientId]);

  useEffect(() => {
    if (!selectedPatientId && inboxRows.length > 0) {
      const firstPing = inboxRows.find((r) => r.unread > 0) || inboxRows[0];
      setSelectedPatientId(firstPing.patientId);
    }
  }, [inboxRows, selectedPatientId]);

  const selectedRow = inboxRows.find((r) => r.patientId === selectedPatientId) ?? null;
  const activeConversationId =
    selectedRow?.conversationId ||
    (doctorId && selectedPatientId
      ? conversationIdFor(doctorId, selectedPatientId)
      : null);

  useEffect(() => {
    if (!activeConversationId || !selectedRow?.conversationId) {
      setMessages([]);
      return;
    }
    const unsub = listenToConversationMessages(
      activeConversationId,
      (next) => setMessages(next),
      (err) => setError(err.message)
    );
    return unsub;
  }, [activeConversationId, selectedRow?.conversationId]);

  useEffect(() => {
    if (!doctorId || !selectedRow?.conversationId || selectedRow.unread === 0) return;
    const unreadIds = messages
      .filter((m) => m.senderId !== doctorId && !m.readBy.includes(doctorId))
      .map((m) => m.id);
    void markConversationRead(selectedRow.conversationId, doctorId, unreadIds);
  }, [doctorId, selectedRow?.conversationId, selectedRow?.unread, messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedPatientId]);

  const handleSend = async () => {
    if (!doctorId || !selectedPatientId || !draft.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const conversationId = await getOrCreateConversation(doctorId, selectedPatientId, {
        currentName: doctorName,
        otherName: selectedRow?.patientName || 'Patient',
      });
      await sendConversationMessage({
        conversationId,
        senderId: doctorId,
        recipientId: selectedPatientId,
        text: draft,
      });
      setDraft('');
      setSelectedPatientId(selectedPatientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  if (isBootstrapping && conversations.length === 0 && patients.length === 0) {
    return (
      <PageShell>
        <MessagesSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Messages"
        description="See who pinged you and reply to patients in real time."
      />

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-[560px] overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-[#eef2f6] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#eef2f6] p-3">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65758b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patients..."
                className="h-10 w-full rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] pl-9 pr-3 text-sm outline-none focus:border-[#427160]"
              />
            </div>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {inboxRows.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#65758b]">
                No messages yet. Patients who ping you will appear here.
              </li>
            ) : (
              inboxRows.map((row) => {
                const active = row.patientId === selectedPatientId;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedPatientId(row.patientId)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        active ? 'bg-[#eef4f1]' : 'hover:bg-[#f8fafc]'
                      }`}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#427160] text-sm font-semibold text-white">
                        {row.patientName
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'P'}
                        {row.unread > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#ef4343]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-sm ${
                              row.unread > 0
                                ? 'font-bold text-[#344256]'
                                : 'font-semibold text-[#344256]'
                            }`}
                          >
                            {row.patientName}
                          </p>
                          {row.unread > 0 && (
                            <span className="inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ef4343] px-1.5 text-[10px] font-bold text-white">
                              {row.unread > 99 ? '99+' : row.unread}
                            </span>
                          )}
                        </div>
                        {row.pingedYou ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-[#427160]">
                            Pinged you
                          </p>
                        ) : null}
                        <p
                          className={`mt-0.5 truncate text-xs ${
                            row.unread > 0 ? 'font-medium text-[#344256]' : 'text-[#65758b]'
                          }`}
                        >
                          {row.preview}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="flex min-h-[420px] flex-col">
          {!selectedRow ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <ChatBubbleLeftRightIcon className="h-10 w-10 text-[#c5ced9]" />
              <p className="mt-3 text-sm font-medium text-[#344256]">No conversations yet</p>
              <p className="mt-1 max-w-sm text-sm text-[#65758b]">
                Only patients who have messaged you show up here. When someone pings you, their
                thread appears with an unread badge.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[#eef2f6] px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#344256]">{selectedRow.patientName}</p>
                    {selectedRow.pingedYou && (
                      <span className="rounded-full bg-[#eef4f1] px-2 py-0.5 text-[11px] font-semibold text-[#427160]">
                        New ping
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#65758b]">
                    {selectedRow.patientEmail || 'No email on file'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/patient-profile/${selectedRow.patientId}`)}
                  className="h-9 rounded-[10px] border border-[#e1e7ef] px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
                >
                  View profile
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messages.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-[#e1e7ef] bg-[#f8fafc] px-4 py-8 text-center text-sm text-[#65758b]">
                    No messages yet. Reply below or wait for the patient to ping you.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const mine = msg.senderId === doctorId;
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-[12px] px-4 py-3 text-sm ${
                          mine
                            ? 'ml-auto bg-[#427160] text-white'
                            : 'mr-auto border border-[#e1e7ef] bg-white text-[#344256]'
                        }`}
                      >
                        {!mine && (
                          <p className="mb-1 text-[11px] font-semibold text-[#427160]">
                            {selectedRow.patientName}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        <p className={`mt-2 text-[11px] ${mine ? 'text-white/70' : 'text-[#94a3b8]'}`}>
                          {msg.createdAt.toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              <div className="border-t border-[#eef2f6] p-4">
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder="Write a reply..."
                    className="min-h-[44px] flex-1 resize-none rounded-[10px] border border-[#e1e7ef] px-3 py-2.5 text-sm outline-none focus:border-[#427160] focus:ring-2 focus:ring-[#427160]/15"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isSending || !draft.trim()}
                    onClick={() => void handleSend()}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#427160] text-white transition-colors hover:bg-[#365c4f] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
};
