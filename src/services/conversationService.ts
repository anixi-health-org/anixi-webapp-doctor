import { isDjangoApiEnabled } from '../lib/runtimeConfig';
import {
  djangoGetOrCreateConversation,
  djangoListConversations,
  djangoListMessages,
  djangoMarkConversationRead,
  djangoSendMessage,
} from './djangoApiService';

export const MESSAGE_MAX_LENGTH = 2000;

export type ConversationParticipant = {
  displayName: string;
  avatarUrl?: string;
};

export type Conversation = {
  id: string;
  participantIds: string[];
  participants: Record<string, ConversationParticipant>;
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: Date;
  };
  unread: Record<string, number>;
  updatedAt?: Date;
  createdAt?: Date;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
  readBy: string[];
};

export type Unsubscribe = () => void;

export const conversationIdFor = (userA: string, userB: string): string =>
  [userA, userB].sort().join('_');

function mapDjangoConversation(row: Record<string, unknown>): Conversation {
  const last = row.lastMessage as Record<string, unknown> | undefined;
  return {
    id: String(row.id),
    participantIds: Array.isArray(row.participantIds)
      ? row.participantIds.map(String)
      : [String(row.patientId ?? ''), String(row.clinicianId ?? '')].filter(Boolean),
    participants: (row.participants as Conversation['participants']) ?? {},
    lastMessage: last
      ? {
          text: String(last.text ?? ''),
          senderId: String(last.senderId ?? ''),
          createdAt: last.createdAt ? new Date(String(last.createdAt)) : new Date(),
        }
      : undefined,
    unread: (row.unread as Record<string, number>) ?? {},
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : undefined,
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : undefined,
  };
}

function mapDjangoMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    senderId: String(row.senderId ?? ''),
    text: String(row.body ?? row.text ?? ''),
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    readBy: Array.isArray(row.readBy) ? row.readBy.map(String) : [],
  };
}

export const getOrCreateConversation = async (
  currentUserId: string,
  otherUserId: string,
  _names?: { currentName?: string; otherName?: string },
): Promise<string> => {
  if (!currentUserId || !otherUserId) throw new Error('Missing participants');
  if (currentUserId === otherUserId) throw new Error('Cannot message yourself');

  if (isDjangoApiEnabled()) {
    const row = await djangoGetOrCreateConversation({
      patientId: otherUserId,
      clinicianId: currentUserId,
    });
    return String(row.id);
  }

  return conversationIdFor(currentUserId, otherUserId);
};

export const sendConversationMessage = async (options: {
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
}): Promise<void> => {
  const text = options.text.trim();
  if (!text) throw new Error('Message cannot be empty');
  if (text.length > MESSAGE_MAX_LENGTH) throw new Error('Message is too long');

  if (isDjangoApiEnabled()) {
    await djangoSendMessage(options.conversationId, text);
    return;
  }

  // Firestore path removed. No-op until migration.
  return;
};

export const markConversationRead = async (
  conversationId: string,
  _userId: string,
  _unreadMessageIds: string[] = [],
): Promise<void> => {
  if (isDjangoApiEnabled()) {
    await djangoMarkConversationRead(conversationId);
  }
};

export const listenToDoctorConversations = (
  doctorId: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError?.(new Error('Doctor ID is required'));
    return () => {};
  }

  if (isDjangoApiEnabled()) {
    let cancelled = false;
    const poll = async () => {
      try {
        const rows = await djangoListConversations();
        if (cancelled) return;
        const conversations = rows
          .map(mapDjangoConversation)
          .sort((a, b) => {
            const aTime = a.updatedAt?.getTime() || a.lastMessage?.createdAt.getTime() || 0;
            const bTime = b.updatedAt?.getTime() || b.lastMessage?.createdAt.getTime() || 0;
            return bTime - aTime;
          });
        onUpdate(conversations);
      } catch (error) {
        if (!cancelled) {
          onError?.(error instanceof Error ? error : new Error('Failed to load conversations'));
        }
      }
    };
    void poll();
    const timer = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }

  onUpdate([]);
  return () => {};
};

export const listenToConversationMessages = (
  conversationId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!conversationId) {
    onError?.(new Error('Conversation ID is required'));
    return () => {};
  }

  if (isDjangoApiEnabled()) {
    let cancelled = false;
    const poll = async () => {
      try {
        const rows = await djangoListMessages(conversationId);
        if (!cancelled) onUpdate(rows.map(mapDjangoMessage));
      } catch (error) {
        if (!cancelled) {
          onError?.(error instanceof Error ? error : new Error('Failed to load messages'));
        }
      }
    };
    void poll();
    const timer = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }

  onUpdate([]);
  return () => {};
};

export const getUnreadPingCount = (conversations: Conversation[], doctorId: string): number =>
  conversations.reduce((sum, c) => sum + (c.unread?.[doctorId] || 0), 0);

export const otherParticipantId = (conversation: Conversation, doctorId: string): string =>
  conversation.participantIds.find((id) => id !== doctorId) || '';

/** Convenience: ensure conversation exists then send (for roster-first compose). */
export const startOrContinueChat = async (options: {
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  text: string;
}): Promise<string> => {
  const conversationId = await getOrCreateConversation(options.doctorId, options.patientId, {
    currentName: options.doctorName,
    otherName: options.patientName,
  });
  await sendConversationMessage({
    conversationId,
    senderId: options.doctorId,
    recipientId: options.patientId,
    text: options.text,
  });
  return conversationId;
};
