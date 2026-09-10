export type StoredAyahMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
};

const STORAGE_PREFIX = 'ayah-doctor-chat-v2';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadAyahChat(userId: string): StoredAyahMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw =
      window.localStorage.getItem(storageKey(userId)) ??
      window.localStorage.getItem(`ayah-doctor-chat-v1:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAyahMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAyahChat(userId: string, messages: StoredAyahMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(messages));
  } catch {
    /* ignore quota errors */
  }
}

export function hasAyahBriefing(userId: string): boolean {
  return loadAyahChat(userId).some(
    (message) => message.role === 'assistant' && message.content.trim().length > 0,
  );
}
