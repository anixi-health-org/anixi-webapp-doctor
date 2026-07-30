import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const CONVERSATIONS = 'conversations';
const MESSAGES = 'messages';

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

const toDate = (value: unknown): Date => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
};

export const conversationIdFor = (userA: string, userB: string): string =>
  [userA, userB].sort().join('_');

const mapConversation = (id: string, data: Record<string, unknown>): Conversation => {
  const last = data.lastMessage as Record<string, unknown> | undefined;
  const participantsRaw = (data.participants as Record<string, ConversationParticipant>) || {};
  const unreadRaw = (data.unread as Record<string, number>) || {};

  return {
    id,
    participantIds: Array.isArray(data.participantIds)
      ? (data.participantIds as string[])
      : [],
    participants: participantsRaw,
    lastMessage: last
      ? {
          text: String(last.text ?? ''),
          senderId: String(last.senderId ?? ''),
          createdAt: toDate(last.createdAt),
        }
      : undefined,
    unread: unreadRaw,
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
    createdAt: data.createdAt ? toDate(data.createdAt) : undefined,
  };
};

const mapMessage = (id: string, data: Record<string, unknown>): ChatMessage => ({
  id,
  senderId: String(data.senderId ?? ''),
  text: String(data.text ?? ''),
  createdAt: toDate(data.createdAt),
  readBy: Array.isArray(data.readBy) ? (data.readBy as string[]) : [],
});

async function resolveDisplayName(userId: string, fallback = 'User'): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'Users', userId));
    if (snap.exists()) {
      const data = snap.data();
      const name =
        (typeof data.displayName === 'string' && data.displayName.trim()) ||
        (typeof data.fullName === 'string' && data.fullName.trim()) ||
        [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
      if (name) return name;
    }
  } catch {
    // ignore and use fallback
  }
  return fallback;
}

export const getOrCreateConversation = async (
  currentUserId: string,
  otherUserId: string,
  names?: { currentName?: string; otherName?: string }
): Promise<string> => {
  if (!currentUserId || !otherUserId) throw new Error('Missing participants');
  if (currentUserId === otherUserId) throw new Error('Cannot message yourself');

  const conversationId = conversationIdFor(currentUserId, otherUserId);
  const conversationRef = doc(db, CONVERSATIONS, conversationId);
  const existing = await getDoc(conversationRef);
  if (existing.exists()) return conversationId;

  const [currentName, otherName] = await Promise.all([
    names?.currentName?.trim()
      ? Promise.resolve(names.currentName.trim())
      : resolveDisplayName(currentUserId, 'Doctor'),
    names?.otherName?.trim()
      ? Promise.resolve(names.otherName.trim())
      : resolveDisplayName(otherUserId, 'Patient'),
  ]);

  await setDoc(
    conversationRef,
    {
      participantIds: [currentUserId, otherUserId],
      participants: {
        [currentUserId]: { displayName: currentName, avatarUrl: '' },
        [otherUserId]: { displayName: otherName, avatarUrl: '' },
      },
      unread: {
        [currentUserId]: 0,
        [otherUserId]: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return conversationId;
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

  const conversationRef = doc(db, CONVERSATIONS, options.conversationId);
  const messageRef = doc(collection(conversationRef, MESSAGES));
  const batch = writeBatch(db);

  batch.set(messageRef, {
    senderId: options.senderId,
    text,
    readBy: [options.senderId],
    createdAt: serverTimestamp(),
  });

  batch.set(
    conversationRef,
    {
      lastMessage: {
        text,
        senderId: options.senderId,
        createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
      unread: {
        [options.recipientId]: increment(1),
        [options.senderId]: 0,
      },
    },
    { merge: true }
  );

  await batch.commit();
};

export const markConversationRead = async (
  conversationId: string,
  userId: string,
  unreadMessageIds: string[] = []
): Promise<void> => {
  const conversationRef = doc(db, CONVERSATIONS, conversationId);
  await setDoc(conversationRef, { unread: { [userId]: 0 } }, { merge: true });

  await Promise.all(
    Array.from(new Set(unreadMessageIds)).map((messageId) =>
      updateDoc(doc(conversationRef, MESSAGES, messageId), {
        readBy: arrayUnion(userId),
      }).catch(() => undefined)
    )
  );
};

export const listenToDoctorConversations = (
  doctorId: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  // array-contains alone needs no composite index; sort by updatedAt client-side
  const q = query(
    collection(db, CONVERSATIONS),
    where('participantIds', 'array-contains', doctorId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const conversations = snapshot.docs
        .map((docSnap) =>
          mapConversation(docSnap.id, docSnap.data() as Record<string, unknown>)
        )
        .sort((a, b) => {
          const aTime = a.updatedAt?.getTime() || a.lastMessage?.createdAt.getTime() || 0;
          const bTime = b.updatedAt?.getTime() || b.lastMessage?.createdAt.getTime() || 0;
          return bTime - aTime;
        });
      onUpdate(conversations);
    },
    (error) => onError?.(error)
  );
};

export const listenToConversationMessages = (
  conversationId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, CONVERSATIONS, conversationId, MESSAGES),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((docSnap) =>
        mapMessage(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      onUpdate(messages);
    },
    (error) => onError?.(error)
  );
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
