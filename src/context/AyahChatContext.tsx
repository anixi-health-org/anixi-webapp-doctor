import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { formatAyahMessageContent } from '../lib/formatAyahReply';
import {
  hasAyahBriefing,
  loadAyahChat,
  saveAyahChat,
  type StoredAyahMessage,
} from '../lib/ayahChatStorage';

type AyahChatContextValue = {
  messages: StoredAyahMessage[];
  hydrated: boolean;
  briefingBootstrapped: boolean;
  setMessages: React.Dispatch<React.SetStateAction<StoredAyahMessage[]>>;
  markBriefingBootstrapped: () => void;
  shouldAutoBrief: () => boolean;
};

const AyahChatContext = createContext<AyahChatContextValue | null>(null);

function sanitizeMessages(messages: StoredAyahMessage[]): StoredAyahMessage[] {
  return messages.map((message) => ({
    ...message,
    content: formatAyahMessageContent(message.role, message.content),
  }));
}

export function AyahChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<StoredAyahMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const briefingBootstrappedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      setHydrated(false);
      briefingBootstrappedRef.current = false;
      return;
    }

    const loaded = sanitizeMessages(loadAyahChat(user.id));
    setMessages(loaded);
    setHydrated(true);
    briefingBootstrappedRef.current = loaded.some(
      (message) => message.role === 'assistant' && message.content.trim().length > 0,
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !hydrated) return;
    saveAyahChat(user.id, messages);
  }, [messages, user?.id, hydrated]);

  const markBriefingBootstrapped = useCallback(() => {
    briefingBootstrappedRef.current = true;
  }, []);

  const shouldAutoBrief = useCallback(() => {
    if (!user?.id || !hydrated) return false;
    if (briefingBootstrappedRef.current) return false;
    return !hasAyahBriefing(user.id);
  }, [hydrated, user?.id]);

  const value = useMemo(
    () => ({
      messages,
      hydrated,
      briefingBootstrapped: briefingBootstrappedRef.current,
      setMessages,
      markBriefingBootstrapped,
      shouldAutoBrief,
    }),
    [messages, hydrated, markBriefingBootstrapped, shouldAutoBrief],
  );

  return <AyahChatContext.Provider value={value}>{children}</AyahChatContext.Provider>;
}

export function useAyahChat() {
  const ctx = useContext(AyahChatContext);
  if (!ctx) {
    throw new Error('useAyahChat must be used within AyahChatProvider');
  }
  return ctx;
}
