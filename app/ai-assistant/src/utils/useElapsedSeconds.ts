import { useEffect, useState } from 'react';

/** Whole seconds since `startedAt`, re-rendering once a second while `active` (e.g. the live loader). */
export const useElapsedSeconds = (
  active: boolean,
  startedAt?: number,
): number => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  return startedAt
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : 0;
};
