import { MicrophoneIcon, StopIcon, XMarkIcon } from '@heroicons/react/24/outline';
import React from 'react';
import type { AyahVoicePhase } from '../../hooks/useAyahVoiceConversation';
import { AyahAvatar } from './AyahAvatar';

type Props = {
  open: boolean;
  phase: AyahVoicePhase;
  error: string | null;
  lastTranscript: string;
  lastReply: string;
  partialReply?: string;
  onClose: () => void;
  onToggleListening: () => void;
};

function phaseLabel(phase: AyahVoicePhase): string {
  switch (phase) {
    case 'listening':
      return 'Listening…';
    case 'processing':
      return 'Ayah is thinking…';
    case 'speaking':
      return 'Ayah is speaking…';
    case 'error':
      return 'Something went wrong';
    default:
      return 'Tap to talk with Ayah';
  }
}

export function AyahVoicePanel({
  open,
  phase,
  error,
  lastTranscript,
  lastReply,
  partialReply,
  onClose,
  onToggleListening,
}: Props) {
  if (!open) return null;
  const visibleReply = partialReply || lastReply;

  const busy = phase === 'processing' || phase === 'speaking';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(17,27,33,0.45)] p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-[24px] bg-white p-5 shadow-[0_24px_64px_rgba(28,39,49,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-[#344256]">Voice with Ayah</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#65758b] hover:bg-[#f4f3ef]"
            aria-label="Close voice mode"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center py-4">
          <div
            className={`rounded-full p-1 ${
              phase === 'listening'
                ? 'bg-[#427160]'
                : phase === 'speaking'
                  ? 'bg-[#53BDEB]'
                  : 'bg-[#eef4f1]'
            }`}
          >
            <AyahAvatar size="lg" />
          </div>
          <p className="mt-3 text-sm font-medium text-[#344256]">{phaseLabel(phase)}</p>
          {error ? <p className="mt-2 text-center text-sm text-red-600">{error}</p> : null}
        </div>

        {lastTranscript ? (
          <div className="mb-3 rounded-xl bg-[#f0f2f5] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">You</p>
            <p className="text-sm text-[#111B21]">{lastTranscript}</p>
          </div>
        ) : null}

        {visibleReply ? (
          <div className="mb-3 rounded-xl bg-[#eef4f1] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">Ayah</p>
            <p className="text-sm text-[#111B21]">{visibleReply}</p>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onToggleListening}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition ${
              phase === 'listening'
                ? 'bg-red-600 hover:bg-red-700'
                : busy
                  ? 'bg-[#65758b]'
                  : 'bg-[#427160] hover:bg-[#365c4e]'
            }`}
            aria-label={phase === 'listening' ? 'Stop listening' : 'Start listening'}
          >
            {phase === 'listening' ? (
              <StopIcon className="h-7 w-7" />
            ) : (
              <MicrophoneIcon className="h-7 w-7" />
            )}
          </button>
          <p className="text-center text-xs text-[#8696A0]">
            {phase === 'listening'
              ? 'Tap again when you finish speaking'
              : 'Hands-free — Ayah listens again after each reply'}
          </p>
        </div>
      </div>
    </div>
  );
}
