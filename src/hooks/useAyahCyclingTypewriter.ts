import { useEffect, useState } from 'react';

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
  enabled?: boolean;
  typeMs?: number;
  deleteMs?: number;
  pauseMs?: number;
};

/** Cycles phrases with type-in / delete-out, for Ayah composer placeholders only. */
export function useAyahCyclingTypewriter(
  phrases: string[],
  { enabled = true, typeMs = 42, deleteMs = 26, pauseMs = 2400 }: Options = {},
) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayText, setDisplayText] = useState(phrases[0] ?? '');
  const phrasesKey = phrases.join('\0');

  useEffect(() => {
    if (!enabled || phrases.length === 0) {
      setDisplayText(phrases[0] ?? '');
      return;
    }

    if (phrases.length === 1) {
      setDisplayText(phrases[0]);
      return;
    }

    if (reducedMotion) {
      let index = 0;
      setDisplayText(phrases[0]);
      const interval = window.setInterval(() => {
        index = (index + 1) % phrases.length;
        setDisplayText(phrases[index]);
      }, pauseMs);
      return () => window.clearInterval(interval);
    }

    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeout: number | undefined;

    const tick = () => {
      const phrase = phrases[phraseIndex] ?? '';

      if (!deleting) {
        if (charIndex < phrase.length) {
          charIndex += 1;
          setDisplayText(phrase.slice(0, charIndex));
          timeout = window.setTimeout(tick, typeMs);
          return;
        }
        timeout = window.setTimeout(() => {
          deleting = true;
          tick();
        }, pauseMs);
        return;
      }

      if (charIndex > 0) {
        charIndex -= 1;
        setDisplayText(phrase.slice(0, charIndex));
        timeout = window.setTimeout(tick, deleteMs);
        return;
      }

      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      timeout = window.setTimeout(tick, typeMs * 2);
    };

    setDisplayText('');
    timeout = window.setTimeout(tick, 400);

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [phrasesKey, enabled, reducedMotion, typeMs, deleteMs, pauseMs, phrases]);

  return {
    displayText,
    showCursor: enabled && phrases.length > 0 && !reducedMotion,
  };
}
