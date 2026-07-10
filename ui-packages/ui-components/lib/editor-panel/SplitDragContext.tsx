import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface SplitDragPayload {
  fileId: string;
  /**
   * Pane the drag originated from. Drop zones use this to decide direction
   * (eg. an A-origin tab dropped on the right edge moves into B; a B-origin
   * tab dropped on the left pane moves into A).
   */
  originPane: 'A' | 'B';
}

export interface TabsBarDropTarget {
  /**
   * Returns the index at which the dragged tab would be inserted for the
   * given pointer position, or null when the pointer is not over this bar.
   */
  getInsertionIndex: (pointer: { x: number; y: number }) => number | null;
  /** Commits the cross-pane move at the given insertion index. */
  commit: (payload: SplitDragPayload, insertIndex: number) => void;
}

interface SplitDragContextValue {
  /** Active drag payload, or `null` if no compatible drag is in progress. */
  payload: SplitDragPayload | null;
  /** Call from a drag source's drag-start. */
  startDrag: (payload: SplitDragPayload) => void;
  /** Report current pointer coords during a non-native drag. */
  updatePointer: (coords: { x: number; y: number } | null) => void;
  /** Call from a drag source's drag-end/drop (always; idempotent). */
  endDrag: () => void;
  /** Register the DOM element of the active drop trigger area. */
  registerTriggerEl: (el: HTMLElement | null) => void;
  /** Register the drop handler (called with the dropped payload). */
  registerDropHandler: (
    cb: ((payload: SplitDragPayload) => void) | null,
  ) => void;
  /**
   * Register a tabs bar as a positional drop target for tabs dragged from
   * the OTHER pane's bar. Foreign-bar drops take precedence over the
   * pane-body trigger so the tab lands at the hovered position. Pass null
   * to unregister.
   */
  registerTabsBarDropTarget: (
    paneId: 'A' | 'B',
    target: TabsBarDropTarget | null,
  ) => void;
  /**
   * Attempt to commit the current drag at the latest pointer position.
   * Returns `true` if the drop landed on the registered split trigger.
   * Drag sources call this from their drag-end before applying their own
   * default behaviour (eg. tab reorder).
   */
  finishDragAtPointer: () => boolean;
}

const SplitDragContext = createContext<SplitDragContextValue | null>(null);

// Pointer coordinates live in their own context so that per-frame drag-move
// updates only re-render consumers that actually track the pointer (the
// drop-zone overlay). The main context value above stays referentially
// stable for the whole drag, so action-only consumers (eg. the tabs bars)
// don't re-render on pointer moves.
const SplitDragPointerContext = createContext<{ x: number; y: number } | null>(
  null,
);

export const SplitDragProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const [payload, setPayload] = useState<SplitDragPayload | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);
  const dropHandlerRef = useRef<((payload: SplitDragPayload) => void) | null>(
    null,
  );
  const payloadRef = useRef<SplitDragPayload | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    pointerRef.current = pointer;
  }, [pointer]);

  const startDrag = useCallback((next: SplitDragPayload) => {
    setPayload(next);
  }, []);

  const endDrag = useCallback(() => {
    setPayload(null);
    setPointer(null);
  }, []);

  const updatePointer = useCallback(
    (coords: { x: number; y: number } | null) => {
      setPointer(coords);
    },
    [],
  );

  const registerTriggerEl = useCallback((el: HTMLElement | null) => {
    triggerElRef.current = el;
  }, []);

  const registerDropHandler = useCallback(
    (cb: ((payload: SplitDragPayload) => void) | null) => {
      dropHandlerRef.current = cb;
    },
    [],
  );

  const tabsBarTargetsRef = useRef<Map<'A' | 'B', TabsBarDropTarget>>(
    new Map(),
  );

  const registerTabsBarDropTarget = useCallback(
    (paneId: 'A' | 'B', target: TabsBarDropTarget | null) => {
      if (target) {
        tabsBarTargetsRef.current.set(paneId, target);
      } else {
        tabsBarTargetsRef.current.delete(paneId);
      }
    },
    [],
  );

  const finishDragAtPointer = useCallback((): boolean => {
    const currentPayload = payloadRef.current;
    const currentPointer = pointerRef.current;
    if (!currentPayload || !currentPointer) {
      return false;
    }
    // Foreign tabs bars take precedence over the pane-body trigger so a
    // drop on the other bar inserts at the hovered tab position.
    for (const [paneId, target] of tabsBarTargetsRef.current) {
      if (paneId === currentPayload.originPane) continue;
      const insertIndex = target.getInsertionIndex(currentPointer);
      if (insertIndex === null) continue;
      target.commit(currentPayload, insertIndex);
      return true;
    }
    const triggerEl = triggerElRef.current;
    const handler = dropHandlerRef.current;
    if (!triggerEl || !handler) {
      return false;
    }
    const rect = triggerEl.getBoundingClientRect();
    const isInside =
      currentPointer.x >= rect.left &&
      currentPointer.x <= rect.right &&
      currentPointer.y >= rect.top &&
      currentPointer.y <= rect.bottom;
    if (!isInside) return false;
    handler(currentPayload);
    return true;
  }, []);

  // Defensive: ensure overlay state is cleared if a drag is aborted in a
  // way that bypasses our handlers (Escape, window blur).
  useEffect(() => {
    if (!payload) return undefined;
    const onWindowBlur = (): void => endDrag();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') endDrag();
    };
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('keydown', onKeyDown);
    return (): void => {
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [payload, endDrag]);

  const value = useMemo<SplitDragContextValue>(
    () => ({
      payload,
      startDrag,
      updatePointer,
      endDrag,
      registerTriggerEl,
      registerDropHandler,
      registerTabsBarDropTarget,
      finishDragAtPointer,
    }),
    [
      payload,
      startDrag,
      updatePointer,
      endDrag,
      registerTriggerEl,
      registerDropHandler,
      registerTabsBarDropTarget,
      finishDragAtPointer,
    ],
  );

  return (
    <SplitDragContext.Provider value={value}>
      <SplitDragPointerContext.Provider value={pointer}>
        {children}
      </SplitDragPointerContext.Provider>
    </SplitDragContext.Provider>
  );
};

/**
 * Access the split-drag context. Returns `null` when used outside a
 * {@link SplitDragProvider}, which lets drag sources (file tree, tabs) be
 * rendered in contexts without a split editor (no-op).
 */
export const useSplitDrag = (): SplitDragContextValue | null => {
  return useContext(SplitDragContext);
};

/**
 * Latest pointer coordinates (viewport-relative) of the active split drag,
 * or `null` when no drag is in progress. Reported by drag sources that
 * don't go through native HTML5 drag events (eg. @dnd-kit tab reordering,
 * which captures pointer events). Updates on every drag-move frame — only
 * subscribe from components that need to follow the pointer visually.
 */
export const useSplitDragPointer = (): { x: number; y: number } | null => {
  return useContext(SplitDragPointerContext);
};
