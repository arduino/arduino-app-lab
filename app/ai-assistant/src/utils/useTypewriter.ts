import { useEffect, useRef, useState } from 'react';

/** Reveal text gradually (typewriter) while a turn is answering; show it in full once settled or idle. */
export const useTypewriter = (
  fullText: string,
  streaming: boolean,
  revealing: boolean,
): string => {
  const [shown, setShown] = useState(() => (streaming ? 0 : fullText.length));
  const targetRef = useRef(fullText.length);
  targetRef.current = fullText.length;

  useEffect(() => {
    if (!streaming) {
      setShown(targetRef.current);
      return;
    }
    if (!revealing) {
      setShown(0);
      return;
    }
    const id = setInterval(() => {
      setShown((prev) => {
        const target = targetRef.current;
        if (prev >= target) {
          return prev;
        }
        return Math.min(
          target,
          prev + Math.max(3, Math.ceil((target - prev) / 8)),
        );
      });
    }, 40);
    return () => clearInterval(id);
  }, [streaming, revealing]);

  // Typewrite only while streaming; settled/replayed turns show full text (the reveal effect doesn't re-run as fullText grows, so `shown` stays stale after a reopen).
  return streaming ? fullText.slice(0, shown) : fullText;
};
