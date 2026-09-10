import clsx from 'clsx';
import { SparklesIcon } from '@heroicons/react/24/outline';
import React from 'react';

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  listening: boolean;
  processing: boolean;
  segmentCount: number;
  audioTrackCount: number;
  transcriptPreview: string;
  error: string | null;
};

export function AyahScribePanel({
  enabled,
  onEnabledChange,
  listening,
  processing,
  segmentCount,
  audioTrackCount,
  transcriptPreview,
  error,
}: Props) {
  return (
    <div className="rounded-xl border border-[#e8eaed] bg-white/95 p-3 shadow-sm backdrop-blur-sm">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#427160] focus:ring-[#427160]/30"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SparklesIcon className="h-4 w-4 text-[#427160]" />
            <span className="text-sm font-semibold text-[#344256]">Ayah scribe</span>
            {listening ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4f1] px-2 py-0.5 text-[10px] font-medium text-[#427160]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#427160]" />
                Listening to call
              </span>
            ) : null}
            {processing ? (
              <span className="text-[10px] font-medium text-[#65758b]">Transcribing…</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-[#65758b]">
            Captures doctor and patient audio from the LiveKit call and drafts a SOAP note after
            the visit.
          </p>
          {enabled ? (
            <p className="mt-1 text-[10px] text-[#94a3b8]">
              {audioTrackCount > 0
                ? `${audioTrackCount} audio source${audioTrackCount !== 1 ? 's' : ''} in mix`
                : 'Waiting for call audio…'}
            </p>
          ) : null}
        </div>
      </label>

      {enabled && (segmentCount > 0 || transcriptPreview) ? (
        <div className="mt-2 rounded-lg bg-[#fafafa] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Live capture · {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
          </p>
          <p
            className={clsx(
              'mt-1 max-h-20 overflow-y-auto text-xs leading-relaxed text-[#65758b]',
              !transcriptPreview && 'italic',
            )}
          >
            {transcriptPreview || 'Waiting for speech from the call…'}
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
