/** Helpers for Django document media paths (storage keys vs authenticated URLs). */

const MEDIA_MARKER = '/api/v1/documents/media/';

export function encodeMediaStorageKey(storageKey: string): string {
  return storageKey
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function extractMediaStorageKey(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!trimmed.includes(MEDIA_MARKER)) {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      return undefined;
    }
    return trimmed.replace(/\/+$/, '') || undefined;
  }

  const start = trimmed.indexOf(MEDIA_MARKER);
  let storageKey = trimmed.slice(start + MEDIA_MARKER.length).split('?')[0].replace(/\/+$/, '');
  try {
    storageKey = decodeURIComponent(storageKey);
  } catch {
    // Keep the raw key when decoding fails.
  }
  return storageKey || undefined;
}

export function isDirectBrowserMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    (/^https?:\/\//i.test(trimmed) && !trimmed.includes(MEDIA_MARKER))
  );
}
