import dropZoneStyles from '@cloud-editor-mono/ide-workbench/lib/editor-panel/editor-split-drop-zone.module.scss';
import clsx from 'clsx';
import { CSSProperties, useLayoutEffect, useState } from 'react';

const RIGHT_PANEL_ID = 'split-right';
const LEFT_PANEL_ID = 'split-left';
// When panel B isn't yet mounted, dropping in the right ~30% of the editor
// area creates panel B with the dropped file. Must match the drop
// hit-test in AppLabEditSection's handleDrop.
const CREATE_B_THRESHOLD = 0.7;
const TABS_BAR_OFFSET = 'var(--editor-tabs-bar-height, 40px)';

interface FileTreeDropOverlayProps {
  /**
   * Container the overlay positions itself against. Should be a
   * `position: relative` ancestor of the split editor panels (typically the
   * `.editor` wrapper in AppLabEditSection).
   */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Last pointer coordinates during the file-tree drag. */
  pointer: { x: number; y: number } | null;
}

/**
 * Highlight overlay shown while a file-tree node is dragged over the
 * editor area. Mirrors {@link EditorSplitDropZone}'s visual treatment so
 * file-tree drags get the same drop-target preview as cross-panel tab
 * drags:
 *
 *  - Pointer over panel A's body (split open) → border highlight on A.
 *  - Pointer over panel B's body (split open) → border highlight on B.
 *  - Pointer in the right ~30% (split closed) → filled preview of the
 *    would-be panel B.
 *  - Pointer elsewhere (split closed) → border highlight on the full
 *    editor area.
 *
 * The drop itself is handled by the host's native dragover/drop
 * listeners; this component is visual only.
 */
const FileTreeDropOverlay = ({
  containerRef,
  pointer,
}: FileTreeDropOverlayProps): JSX.Element | null => {
  // Recompute geometry on every pointer update so the highlight follows
  // the user's cursor across panels. Layout-effect avoids a flash of stale
  // geometry between dragover and paint.
  const [style, setStyle] = useState<{
    overlay: CSSProperties;
    filled: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !pointer) {
      setStyle(null);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const rightPanelEl = container.querySelector<HTMLElement>(
      `#${RIGHT_PANEL_ID}`,
    );
    const leftPanelEl = container.querySelector<HTMLElement>(
      `#${LEFT_PANEL_ID}`,
    );

    const rectFor = (
      el: HTMLElement,
    ): { left: number; width: number; top: number; height: number } => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - containerRect.left,
        width: r.width,
        top: r.top - containerRect.top,
        height: r.height,
      };
    };

    if (rightPanelEl && leftPanelEl) {
      const rightRect = rightPanelEl.getBoundingClientRect();
      const target = pointer.x >= rightRect.left ? rightPanelEl : leftPanelEl;
      const geo = rectFor(target);
      setStyle({
        overlay: {
          left: geo.left,
          width: geo.width,
          top: `calc(${geo.top}px + ${TABS_BAR_OFFSET})`,
          height: `calc(${geo.height}px - ${TABS_BAR_OFFSET})`,
        },
        filled: false,
      });
      return;
    }

    const relX = pointer.x - containerRect.left;
    const willCreateB = relX > containerRect.width * CREATE_B_THRESHOLD;
    if (willCreateB) {
      setStyle({
        overlay: {
          left: '50%',
          right: 0,
          top: TABS_BAR_OFFSET,
          bottom: 0,
        },
        filled: true,
      });
    } else {
      setStyle({
        overlay: {
          left: 0,
          right: 0,
          top: TABS_BAR_OFFSET,
          bottom: 0,
        },
        filled: false,
      });
    }
  }, [containerRef, pointer]);

  if (!style) return null;

  return (
    <div
      className={dropZoneStyles['drop-zone']}
      aria-hidden
      style={{ pointerEvents: 'none' }}
    >
      <div
        className={clsx(
          dropZoneStyles.overlay,
          dropZoneStyles['overlay--visible'],
          {
            [dropZoneStyles['overlay--fill']]: style.filled,
            [dropZoneStyles['overlay--border']]: !style.filled,
          },
        )}
        style={style.overlay}
      />
    </div>
  );
};

export default FileTreeDropOverlay;
