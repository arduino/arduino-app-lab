import clsx from 'clsx';
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './editor-split-drop-zone.module.scss';
import {
  SplitDragPayload,
  useSplitDrag,
  useSplitDragPointer,
} from './SplitDragContext';

// Geometry constants for the CLOSED-split state (right pane not yet open),
// expressed as horizontal offsets from the LEFT edge of the editor area.
// The right edge is always pinned to `right: 0`.
//
//  - The trigger (actual drop target) covers the right 40% — a wider hit
//    region to make activation easier.
//  - The visual overlay previews the right 50%, matching the default width
//    the new right pane will occupy once opened.
const TRIGGER_LEFT_OFFSET_CLOSED = '60%';
const OVERLAY_LEFT_OFFSET_CLOSED = '50%';
// Top offset (in px) used when the right pane is already open, to clear its
// tabs bar so right-pane tab interactions remain clickable during a drag.
// Reads the shared --editor-tabs-bar-height custom property with a 40px
// fallback matching the tabs-bar SCSS definition.
const TABS_BAR_OFFSET_OPEN = 'var(--editor-tabs-bar-height, 40px)';
// DOM `id`s of the two `<Panel>`s in EditorPanel. react-resizable-panels v4
// reflects the `id` prop onto the rendered element as a regular `id`
// attribute (no `data-panel-id` is emitted), so we look it up by `#id`.
const RIGHT_PANE_PANEL_ID = 'split-right';
const LEFT_PANE_PANEL_ID = 'split-left';

interface EditorSplitDropZoneProps {
  /** Whether the right (split) pane is currently shown. */
  isSplit: boolean;
  /**
   * Number of tabs currently in pane A. When an A→B tab drag would leave
   * pane A empty (count <= 1) AND no split is open, the drop is a no-op
   * so the overlay is suppressed. With a split open the drag is allowed —
   * it moves the file into panel B and collapses the split to B's content.
   */
  paneATabsCount: number;
  /**
   * Called when a draggable tab is dropped on the cross-pane target. The
   * receiver should move (not duplicate) `fileId` from `fromPane` to the
   * opposite pane. Idempotent on destination.
   */
  onMove: (fileId: string, fromPane: 'A' | 'B') => void;
}

/**
 * Cross-pane drop zone overlay rendered inside the editor area to support
 * Move-on-drag of tabs between the two panels.
 *
 * Drag sources (currently only @dnd-kit tab reorder) report their pointer
 * coordinates to {@link SplitDragContext} during a drag and call
 * `finishDragAtPointer()` on drop. The overlay's trigger geometry depends
 * on the drag's `originPane`:
 *  - A-origin drag: trigger covers the right edge (or panel B body when
 *    open) → moves the tab into panel B (creating it if needed).
 *  - B-origin drag: trigger covers panel A body → moves the tab into
 *    panel A. Always requires `isSplit` to be true (B must exist).
 */
const EditorSplitDropZone = ({
  isSplit,
  paneATabsCount,
  onMove,
}: EditorSplitDropZoneProps): JSX.Element | null => {
  const splitDrag = useSplitDrag();
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  // Stash the context in a ref so the ref callback identity doesn't change
  // when the context value is rebuilt (drag start/end), which would
  // otherwise cause React to detach/reattach the trigger registration.
  const splitDragRef = useRef(splitDrag);
  useEffect(() => {
    splitDragRef.current = splitDrag;
  }, [splitDrag]);

  const payload = splitDrag?.payload ?? null;
  // Subscribed separately so only this component re-renders per drag-move
  // frame; the actions context above stays stable for the whole drag.
  const pointer = useSplitDragPointer();
  const originPane: 'A' | 'B' | null = payload?.originPane ?? null;

  useEffect(() => {
    if (!splitDrag) return undefined;
    const handler = (p: SplitDragPayload): void =>
      onMove(p.fileId, p.originPane);
    splitDrag.registerDropHandler(handler);
    return (): void => splitDrag.registerDropHandler(null);
  }, [splitDrag, onMove]);

  // Stable ref callback. React will call this with `null` automatically when
  // the trigger element is unmounted (drag ends → component returns null),
  // so no separate cleanup effect is needed; adding one would race with the
  // ref-rebind that happens when `splitDrag` (context value) changes during
  // an active drag and would leave the trigger ref null at drop time.
  const setTriggerEl = useCallback((el: HTMLDivElement | null) => {
    triggerRef.current = el;
    splitDragRef.current?.registerTriggerEl(el);
  }, []);

  // Track the live geometry of the destination pane while a drag is in
  // progress so the trigger + border overlay follow the actual pane bounds
  // (the user can freely resize the split via the separator). The pane we
  // measure depends on the drag's origin: an A-origin drag targets the
  // RIGHT pane (when present), a B-origin drag targets the LEFT pane.
  // Falls back to fixed offsets until the first measurement lands.
  const [destPaneGeometry, setDestPaneGeometry] = useState<{
    left: number;
    width: number;
  } | null>(null);
  useEffect(() => {
    if (!payload) {
      setDestPaneGeometry(null);
      return undefined;
    }
    const wrapper = dropZoneRef.current?.parentElement;
    const dropZoneEl = dropZoneRef.current;
    if (!wrapper || !dropZoneEl) return undefined;
    const targetId =
      originPane === 'B' ? LEFT_PANE_PANEL_ID : RIGHT_PANE_PANEL_ID;
    const destPane = wrapper.querySelector<HTMLElement>(`#${targetId}`);
    // A-origin drag with no right pane yet — fall back to right-edge geometry.
    if (!destPane) {
      setDestPaneGeometry(null);
      return undefined;
    }
    const measure = (): void => {
      const wrapperRect = dropZoneEl.getBoundingClientRect();
      const paneRect = destPane.getBoundingClientRect();
      setDestPaneGeometry({
        left: paneRect.left - wrapperRect.left,
        width: paneRect.width,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    ro.observe(destPane);
    return (): void => ro.disconnect();
  }, [payload, originPane, isSplit]);

  const isOver = useMemo(() => {
    if (!pointer || !triggerRef.current) return false;
    const rect = triggerRef.current.getBoundingClientRect();
    return (
      pointer.x >= rect.left &&
      pointer.x <= rect.right &&
      pointer.y >= rect.top &&
      pointer.y <= rect.bottom
    );
  }, [pointer]);

  if (!payload) return null;
  // A B-origin drag is only meaningful when both panes exist; bail out
  // defensively if the right pane has been torn down mid-drag.
  if (originPane === 'B' && !isSplit) return null;
  // Suppress the overlay for A→B drags that have nowhere to land: with no
  // split open, dragging the only tab of pane A to the right is a no-op
  // (the move would empty pane A and there is no panel B to land in).
  // With a split open the drag IS meaningful — the file moves into panel
  // B and the split collapses to B's content (see moveTabToOtherPane).
  if (originPane === 'A' && paneATabsCount <= 1 && !isSplit) return null;

  let triggerStyle: CSSProperties;
  let overlayStyle: CSSProperties;
  if (destPaneGeometry) {
    const { left, width } = destPaneGeometry;
    triggerStyle = { left, width, top: TABS_BAR_OFFSET_OPEN };
    overlayStyle = { left, width, top: TABS_BAR_OFFSET_OPEN };
  } else {
    // A-origin drag with no right pane yet — right-edge drop creates B.
    triggerStyle = {
      left: TRIGGER_LEFT_OFFSET_CLOSED,
      right: 0,
      top: TABS_BAR_OFFSET_OPEN,
    };
    overlayStyle = {
      left: OVERLAY_LEFT_OFFSET_CLOSED,
      right: 0,
      top: TABS_BAR_OFFSET_OPEN,
    };
  }

  const overlayFilled = !isSplit;

  return (
    <div ref={dropZoneRef} className={styles['drop-zone']} aria-hidden>
      <div ref={setTriggerEl} className={styles.trigger} style={triggerStyle} />
      <div
        className={clsx(styles.overlay, {
          [styles['overlay--fill']]: overlayFilled,
          [styles['overlay--border']]: !overlayFilled,
          [styles['overlay--visible']]: isOver,
        })}
        style={overlayStyle}
      />
    </div>
  );
};

export default EditorSplitDropZone;
