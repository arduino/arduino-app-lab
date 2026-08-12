import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface UsePanelPersistence {
  storedSize: number | undefined;
  setStoredSize: (sizePx: number) => void;
}

const read = (storageKey: string): number | undefined => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return undefined;
    }
    const value = Number(JSON.parse(raw));
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const write = (storageKey: string, px: number): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(px));
  } catch {
    // Persisting panel size is best-effort.
  }
};

/**
 * Custom persistence layer that stores a panel's last known size in pixels,
 * replacing react-resizable-panels' built-in percentage-based persistence
 * (which does not scale across sessions on differently sized screens).
 */
export const usePanelPersistence = (
  storageKey: string,
): UsePanelPersistence => {
  const [storedSize] = useState<number | undefined>(() => read(storageKey));

  const persist = useMemo(
    () =>
      debounce((sizePx: number) => {
        write(storageKey, sizePx);
      }, 300),
    [storageKey],
  );

  useEffect(() => (): void => persist.cancel(), [persist]);

  const setStoredSize = useCallback(
    (sizePx: number): void => {
      persist(sizePx);
    },
    [persist],
  );

  return { storedSize, setStoredSize };
};
