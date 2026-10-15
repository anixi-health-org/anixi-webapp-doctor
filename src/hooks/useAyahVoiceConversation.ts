import { useCallback, useEffect, useRef, useState } from 'react';
import { djangoVoiceStream, isDjangoApiEnabled } from '../services/djangoApiService';
import {
  enqueueAyahVoiceAudio,
  resetAyahVoiceAudioQueue,
} from '../lib/ayahVoiceAudioQueue';

export type AyahVoicePhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

type TurnResult = {
  transcript: string;
  replyText: string;
};

type Options = {
  threadId?: string;
  languageCode?: string;
  context?: Record<string, unknown>;
  getContext?: () => Record<string, unknown>;
  onTurn?: (turn: TurnResult) => void;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read audio'));
        return;
      }
      const base64 = reader.result.split(',')[1] ?? '';
      if (!base64) {
        reject(new Error('Could not read audio'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read audio'));
    reader.readAsDataURL(blob);
  });
}

export function useAyahVoiceConversation(options: Options) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<AyahVoicePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [partialReply, setPartialReply] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const activeRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopStream = useCallback(() => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const stopConversation = useCallback(async () => {
    activeRef.current = false;
    setActive(false);
    setPhase('idle');
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    stopStream();
    resetAyahVoiceAudioQueue();
    setPartialReply('');
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    if (!activeRef.current) return;
    if (!isDjangoApiEnabled()) {
      setError('Voice mode requires the Anixi API.');
      setPhase('error');
      return;
    }
    setError(null);
    setPhase('listening');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      void (async () => {
        if (!activeRef.current) return;
        setPhase('processing');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stopStream();
        if (!blob.size) {
          setError('No audio captured. Try again.');
          setPhase('error');
          return;
        }
        try {
          const audioBase64 = await blobToBase64(blob);
          let replyText = '';
          let transcriptText = '';
          await djangoVoiceStream({
            audioBase64,
            mimeType,
            languageCode: optionsRef.current.languageCode ?? 'en-ZA',
            threadId: optionsRef.current.threadId,
            speakReply: true,
            context:
              optionsRef.current.getContext?.() ??
              optionsRef.current.context,
            onEvent: (event) => {
              if (event.type === 'transcript') {
                transcriptText = event.text;
                setLastTranscript(event.text);
              }
              if (event.type === 'text-delta') {
                replyText += event.delta;
                setPartialReply(replyText);
                setPhase('processing');
              }
              if (event.type === 'audio') {
                setPhase('speaking');
                void enqueueAyahVoiceAudio(event.audioBase64, event.mimeType);
              }
              if (event.type === 'done') {
                replyText = event.replyText;
                setLastReply(event.replyText);
                setPartialReply(event.replyText);
              }
            },
          });
          if (replyText.trim()) {
            optionsRef.current.onTurn?.({
              transcript: transcriptText,
              replyText: replyText.trim(),
            });
          }
          if (activeRef.current) {
            await startRecording();
            return;
          }
          setPhase('idle');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Voice turn failed');
          setPhase('error');
        }
      })();
    };
    recorder.start();
  }, [stopStream]);

  const startConversation = useCallback(async () => {
    activeRef.current = true;
    setActive(true);
    setError(null);
    await startRecording();
  }, [startRecording]);

  const toggleListening = useCallback(async () => {
    if (phase === 'listening') {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      return;
    }
    if (!activeRef.current) {
      await startConversation();
      return;
    }
    if (phase === 'error' || phase === 'idle') {
      await startRecording();
    }
  }, [phase, startConversation, startRecording]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  return {
    active,
    phase,
    error,
    lastTranscript,
    lastReply,
    partialReply,
    startConversation,
    stopConversation,
    toggleListening,
  };
}
