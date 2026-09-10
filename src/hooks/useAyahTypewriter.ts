import { useEffect, useRef, useState } from 'react';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}

type Options = {
  /** When true, text reveals with a typewriter effect. */
  enabled?: boolean;
  /** Milliseconds between character reveals at normal pace. */
  charIntervalMs?: number;
};

export function useAyahTypewriter(
  text: string,
  { enabled = false, charIntervalMs = 18 }: Options = {},
) {
  const reducedMotion = usePrefersReducedMotion();
  const animatingRef = useRef(enabled);
  const [visibleLength, setVisibleLength] = useState(() =>
    enabled && !reducedMotion ? 0 : text.length,
  );

  useEffect(() => {
    if (enabled) animatingRef.current = true;
  }, [enabled]);

  useEffect(() => {
    if (reducedMotion || (!enabled && !animatingRef.current)) {
      setVisibleLength(text.length);
      return;
    }

    if (!animatingRef.current) {
      setVisibleLength(text.length);
      return;
    }

    if (visibleLength >= text.length) {
      if (!enabled) animatingRef.current = false;
      return;
    }

    const behind = text.length - visibleLength;
    const delay = behind > 80 ? 8 : behind > 30 ? 12 : charIntervalMs;

    const timer = window.setTimeout(() => {
      setVisibleLength((prev) => {
        const nextBehind = text.length - prev;
        const step = nextBehind > 80 ? 4 : nextBehind > 30 ? 2 : 1;
        return Math.min(prev + step, text.length);
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [text, visibleLength, enabled, reducedMotion, charIntervalMs]);

  useEffect(() => {
    if (text.length < visibleLength) {
      setVisibleLength(text.length);
    }
  }, [text.length, visibleLength]);

  const displayText = text.slice(0, visibleLength);
  const isTyping = animatingRef.current && visibleLength < text.length;
  const showCursor = isTyping && !reducedMotion;

  return { displayText, showCursor, isTyping, isComplete: visibleLength >= text.length };
}
