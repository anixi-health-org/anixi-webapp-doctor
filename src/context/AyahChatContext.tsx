import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  buildAyahDoctorWelcomeMessage,
  isLegacyAutoBriefSession,
} from '../lib/ayahDoctorWelcome';
import { formatAyahMessageContent } from '../lib/formatAyahReply';
import { loadAyahChat, saveAyahChat, type StoredAyahMessage } from '../lib/ayahChatStorage';

type AyahChatContextValue = {
  messages: StoredAyahMessage[];
  hydrated: boolean;
  setMessages: React.Dispatch<React.SetStateAction<StoredAyahMessage[]>>;
  resetToWelcome: (options?: { displayName?: string; patientName?: string }) => void;
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

  const resetToWelcome = useCallback(
    (options?: { displayName?: string; patientName?: string }) => {
      setMessages([
        buildAyahDoctorWelcomeMessage({
          displayName: options?.displayName ?? user?.displayName,
          patientName: options?.patientName,
        }),
      ]);
    },
    [user?.displayName],
  );

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      setHydrated(false);
      return;
    }

    const loaded = sanitizeMessages(loadAyahChat(user.id));
    const welcome = buildAyahDoctorWelcomeMessage({ displayName: user.displayName });
    setMessages(
      loaded.length === 0 || isLegacyAutoBriefSession(loaded) ? [welcome] : loaded,
    );
    setHydrated(true);
  }, [user?.id, user?.displayName]);

  useEffect(() => {
    if (!user?.id || !hydrated) return;
    saveAyahChat(user.id, messages);
  }, [messages, user?.id, hydrated]);

  const value = useMemo(
    () => ({
      messages,
      hydrated,
      setMessages,
      resetToWelcome,
    }),
    [messages, hydrated, resetToWelcome],
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
