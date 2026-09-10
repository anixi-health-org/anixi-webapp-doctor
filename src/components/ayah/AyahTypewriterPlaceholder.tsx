import clsx from 'clsx';
import React from 'react';
import { useAyahCyclingTypewriter } from '../../hooks/useAyahCyclingTypewriter';
import { AyahTypewriterCursor } from './AyahTypewriterText';

type Props = {
  phrases: string[];
  enabled?: boolean;
  className?: string;
};

export function AyahTypewriterPlaceholder({ phrases, enabled = true, className }: Props) {
  const { displayText, showCursor } = useAyahCyclingTypewriter(phrases, { enabled });

  if (!enabled || phrases.length === 0) return null;

  return (
    <div
      className={clsx(
        'pointer-events-none absolute inset-0 flex items-start overflow-hidden text-[15px] leading-relaxed text-[#94a3b8]',
        className,
      )}
      aria-hidden
    >
      <span className="whitespace-pre-wrap break-words">
        {displayText}
        {showCursor ? <AyahTypewriterCursor className="bg-[#94a3b8]" /> : null}
      </span>
    </div>
  );
}
