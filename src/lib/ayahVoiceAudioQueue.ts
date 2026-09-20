let queue: Array<{ audioBase64: string; mimeType: string }> = [];
let playing = false;

function playBase64Audio(audioBase64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Could not play Ayah voice reply'));
    void audio.play().catch(reject);
  });
}

export function resetAyahVoiceAudioQueue(): void {
  queue = [];
  playing = false;
}

export async function enqueueAyahVoiceAudio(
  audioBase64: string,
  mimeType = 'audio/mpeg',
): Promise<void> {
  queue.push({ audioBase64, mimeType });
  if (!playing) {
    await drainQueue();
  }
}

async function drainQueue(): Promise<void> {
  playing = true;
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    await playBase64Audio(next.audioBase64, next.mimeType);
  }
  playing = false;
}
