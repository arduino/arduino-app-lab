import clsx from 'clsx';
import {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ChevronDown } from '../../assets/icons';
import styles from './context-menu-scroll-area.module.scss';

// Pixels per millisecond while a chevron is hovered, the speed the menu scrolled at
// before the Radix migration dropped it (the old menu ran 5px every 10ms)
const SCROLL_SPEED = 0.5;

// Assumed elapsed time for the first frame, so the hover moves the list right away
const FIRST_FRAME_MS = 16;

export interface ContextMenuScrollAreaProps {
  children: ReactNode;
}

// Limits the item list to the window height and scrolls it with chevrons instead of a
// scrollbar. The chevrons appear only in a window shorter than the menu (about 590px
// with the LSP items).
export const ContextMenuScrollArea = ({
  children,
}: ContextMenuScrollAreaProps): ReactElement => {
  const viewportRef = useRef<HTMLDivElement>(null);
  // React 19 removed the no-argument useRef overload, and `undefined` is the
  // state this holds between frames anyway.
  const frameRef = useRef<number | undefined>(undefined);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const syncScrollState = useCallback((): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    setCanScrollUp(scrollTop > 0);
    setCanScrollDown(Math.ceil(scrollTop + clientHeight) < scrollHeight);
  }, []);

  const stopScrolling = useCallback((): void => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);

  const startScrolling = useCallback(
    (direction: 1 | -1): void => {
      stopScrolling();
      let previous: number | undefined;
      const step = (timestamp: number): void => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const elapsed =
          previous === undefined ? FIRST_FRAME_MS : timestamp - previous;
        previous = timestamp;
        viewport.scrollTop += direction * SCROLL_SPEED * elapsed;
        syncScrollState();
        frameRef.current = requestAnimationFrame(step);
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [stopScrolling, syncScrollState],
  );

  // The menu mounts with its items already in place, but the LSP items can land
  // while it is open, so track the viewport's size as well as its scroll offset.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    syncScrollState();
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(viewport);
    if (viewport.firstElementChild)
      observer.observe(viewport.firstElementChild);
    return (): void => observer.disconnect();
  }, [syncScrollState]);

  useEffect(() => stopScrolling, [stopScrolling]);

  const renderChevron = (direction: 1 | -1): ReactElement => (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      className={clsx(
        styles['context-menu-scroll-chevron'],
        direction === -1
          ? styles['context-menu-scroll-chevron-up']
          : styles['context-menu-scroll-chevron-down'],
      )}
      // Keeps the click from pulling focus off the menu, which would close it
      onPointerDown={(event): void => event.preventDefault()}
      onPointerEnter={(): void => startScrolling(direction)}
      onPointerLeave={stopScrolling}
    >
      <ChevronDown />
    </button>
  );

  return (
    <div className={styles['context-menu-scroll-area']}>
      {canScrollUp && renderChevron(-1)}
      <div
        ref={viewportRef}
        className={styles['context-menu-scroll-viewport']}
        onScroll={syncScrollState}
      >
        <div>{children}</div>
      </div>
      {canScrollDown && renderChevron(1)}
    </div>
  );
};
