/**
 * One visible-tab poll for doctor live data.
 * Listeners share a single in-flight refresh instead of each owning a timer.
 */

type Listener<T> = {
  onUpdate: (value: T) => void;
  onError: (error: Error) => void;
};

type Channel<T> = {
  load: () => Promise<T>;
  listeners: Set<Listener<T>>;
};

const POLL_MS = 30_000;
const channels = new Map<string, Channel<unknown>>();
let timer: ReturnType<typeof setInterval> | null = null;
let refreshInflight: Promise<void> | null = null;
let refreshQueued = false;
let visibilityBound = false;

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

async function refreshAll(): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (refreshInflight) {
    refreshQueued = true;
    return refreshInflight;
  }
  const snapshot = Array.from(channels.values());
  refreshInflight = (async () => {
    await Promise.all(
      snapshot.map(async (channel) => {
        try {
          const value = await channel.load();
          channel.listeners.forEach((listener: Listener<unknown>) => listener.onUpdate(value));
        } catch (error) {
          const err = asError(error, 'Failed to refresh live data');
          channel.listeners.forEach((listener: Listener<unknown>) => listener.onError(err));
        }
      }),
    );
  })().finally(() => {
    refreshInflight = null;
    if (refreshQueued) {
      refreshQueued = false;
      void refreshAll();
    }
  });
  return refreshInflight;
}

function ensureLoop(): void {
  if (timer == null) {
    timer = setInterval(() => {
      void refreshAll();
    }, POLL_MS);
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refreshAll();
    });
  }
}

function stopLoopIfIdle(): void {
  if (channels.size > 0 || timer == null) return;
  clearInterval(timer);
  timer = null;
}

export function subscribeDoctorLiveChannel<T>(
  key: string,
  load: () => Promise<T>,
  onUpdate: (value: T) => void,
  onError: (error: Error) => void,
): () => void {
  let channel = channels.get(key) as Channel<T> | undefined;
  if (!channel) {
    channel = { load, listeners: new Set() };
    channels.set(key, channel as Channel<unknown>);
  }
  const listener: Listener<T> = { onUpdate, onError };
  channel.listeners.add(listener);
  ensureLoop();
  void refreshAll();
  return () => {
    channel?.listeners.delete(listener);
    if (channel && channel.listeners.size === 0) {
      channels.delete(key);
    }
    stopLoopIfIdle();
  };
}
