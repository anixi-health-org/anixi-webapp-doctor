import { ConnectionState, RoomEvent } from 'livekit-client';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  createLiveKitMixedAudioStream,
  ensureRemoteAudioSubscribed,
} from '../../lib/livekitScribeAudio';
import { transcribeConsultChunk } from '../../services/consultScribeService';

const CHUNK_MS = 22_000;

export type LiveKitScribeHandle = {
  stop: () => Promise<string>;
};

export type LiveKitScribeState = {
  listening: boolean;
  processing: boolean;
  transcript: string;
  segmentCount: number;
  audioTrackCount: number;
  error: string | null;
};

type Props = {
  enabled: boolean;
  onStateChange?: (state: LiveKitScribeState) => void;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read audio'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read audio'));
    reader.readAsDataURL(blob);
  });
}

export const LiveKitScribeController = forwardRef<LiveKitScribeHandle, Props>(
  function LiveKitScribeController({ enabled, onStateChange }, ref) {
    const room = useRoomContext();
    const connectionState = useConnectionState();

    const [listening, setListening] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [segmentCount, setSegmentCount] = useState(0);
    const [audioTrackCount, setAudioTrackCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mixerRef = useRef<ReturnType<typeof createLiveKitMixedAudioStream> | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunkTimerRef = useRef<number | null>(null);
    const transcriptRef = useRef('');
    const processingRef = useRef(false);
    const enabledRef = useRef(enabled);
    const startingChunkRef = useRef(false);

    useEffect(() => {
      enabledRef.current = enabled;
    }, [enabled]);

    useEffect(() => {
      transcriptRef.current = transcript;
    }, [transcript]);

    const publishState = useCallback(() => {
      onStateChange?.({
        listening,
        processing,
        transcript,
        segmentCount,
        audioTrackCount,
        error,
      });
    }, [audioTrackCount, error, listening, onStateChange, processing, segmentCount, transcript]);

    useEffect(() => {
      publishState();
    }, [publishState]);

    const transcribeBlob = useCallback(async (blob: Blob, mimeType: string) => {
      if (!blob.size) return;
      processingRef.current = true;
      setProcessing(true);
      try {
        const base64 = await blobToBase64(blob);
        const text = await transcribeConsultChunk(base64, mimeType);
        if (text) {
          transcriptRef.current = transcriptRef.current
            ? `${transcriptRef.current}\n${text}`
            : text;
          setTranscript(transcriptRef.current);
          setSegmentCount((count) => count + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scribe transcription failed');
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    }, []);

    const stopRecorder = useCallback(() => {
      if (chunkTimerRef.current != null) {
        window.clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorderRef.current = null;
    }, []);

    const startChunk = useCallback(async () => {
      if (!enabledRef.current || !mixerRef.current?.stream || startingChunkRef.current) return;
      startingChunkRef.current = true;
      stopRecorder();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      mixerRef.current.resume();
      setAudioTrackCount(mixerRef.current.trackCount);

      const recorder = new MediaRecorder(mixerRef.current.stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          void transcribeBlob(event.data, mimeType);
        }
      };

      recorder.onstop = () => {
        startingChunkRef.current = false;
      };

      recorder.start();

      chunkTimerRef.current = window.setInterval(() => {
        const active = recorderRef.current;
        if (active?.state === 'recording') {
          active.stop();
          void startChunk();
        }
      }, CHUNK_MS);

      startingChunkRef.current = false;
    }, [stopRecorder, transcribeBlob]);

    const startCapture = useCallback(async () => {
      if (!room || connectionState !== ConnectionState.Connected) return;
      setError(null);
      ensureRemoteAudioSubscribed(room);
      mixerRef.current?.dispose();
      mixerRef.current = createLiveKitMixedAudioStream(room);
      setAudioTrackCount(mixerRef.current.trackCount);

      if (mixerRef.current.trackCount === 0) {
        setError('Waiting for call audio. Patient or mic not connected yet.');
      }

      setListening(true);
      await startChunk();
    }, [connectionState, room, startChunk]);

    const stopCapture = useCallback(async () => {
      setListening(false);
      stopRecorder();
      mixerRef.current?.dispose();
      mixerRef.current = null;
      while (processingRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      return transcriptRef.current.trim();
    }, [stopRecorder]);

    useImperativeHandle(ref, () => ({
      stop: stopCapture,
    }));

    useEffect(() => {
      if (!enabled) {
        if (listening) void stopCapture();
        return;
      }
      if (connectionState === ConnectionState.Connected && !listening) {
        void startCapture();
      }
    }, [connectionState, enabled, listening, startCapture, stopCapture]);

    useEffect(() => {
      if (!room || !enabled) return;
      const refresh = () => {
        ensureRemoteAudioSubscribed(room);
        if (mixerRef.current) {
          setAudioTrackCount(mixerRef.current.trackCount);
        }
      };
      room.on(RoomEvent.TrackSubscribed, refresh);
      room.on(RoomEvent.ParticipantConnected, refresh);
      return () => {
        room.off(RoomEvent.TrackSubscribed, refresh);
        room.off(RoomEvent.ParticipantConnected, refresh);
      };
    }, [enabled, room]);

    useEffect(
      () => () => {
        stopRecorder();
        mixerRef.current?.dispose();
      },
      [stopRecorder],
    );

    return null;
  },
);
