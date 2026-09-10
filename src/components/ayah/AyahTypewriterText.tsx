import clsx from 'clsx';
import React from 'react';
import { useAyahTypewriter } from '../../hooks/useAyahTypewriter';

type Props = {
  text: string;
  /** When true, text types in on mount or while streaming. */
  animate?: boolean;
  className?: string;
  as?: 'span' | 'p';
};

export function AyahTypewriterCursor({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'ayah-typewriter-cursor ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-[#427160]',
        className,
      )}
      aria-hidden
    />
  );
}

export function AyahTypewriterText({
  text,
  animate = false,
  className,
  as: Tag = 'span',
}: Props) {
  const { displayText, showCursor } = useAyahTypewriter(text, { enabled: animate });

  return (
    <Tag className={className}>
      {displayText}
      {showCursor ? <AyahTypewriterCursor /> : null}
    </Tag>
  );
}
