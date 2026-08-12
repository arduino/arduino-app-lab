import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react';
import {
  PanelImperativeHandle,
  usePanelCallbackRef,
} from 'react-resizable-panels';

import { usePanelPersistence } from './usePanelPersistence';

const groupMaxSizePx = (panel: PanelImperativeHandle): number => {
  const size = panel.getSize();
  return size.asPercentage > 0
    ? (size.inPixels * 100) / size.asPercentage
    : size.inPixels;
};

const panelMaxSizePx = (
  panel: PanelImperativeHandle,
  siblingMinSizePx = 0,
): number => groupMaxSizePx(panel) - siblingMinSizePx;

const MAXIMIZED_TOLERANCE_PX = 10;

// Works for any size, not just the panel's current one
const isMaxSizePx = (
  sizePx: number,
  panel: PanelImperativeHandle,
  siblingMinSizePx = 0,
): boolean =>
  sizePx >= panelMaxSizePx(panel, siblingMinSizePx) - MAXIMIZED_TOLERANCE_PX;

const isPanelMaximized = (
  panel: PanelImperativeHandle,
  siblingMinSizePx = 0,
): boolean => isMaxSizePx(panel.getSize().inPixels, panel, siblingMinSizePx);

export const panelStorageKey = (id: string, appId?: string): string =>
  appId ? `al-panel:${id}:${appId}` : `al-panel:${id}`;

export interface WorkspacePanelAPI {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  isMaximized: boolean;
  toggleMaximize: () => void;
}

export type UseWorkspacePanel = (params: {
  storageKey: string;
  defaultSize?: number;
  sibling?: {
    minSizePx?: number;
  };
}) => {
  panel: PanelImperativeHandle | null;
  storedSize: number | undefined;
  setRef: Dispatch<SetStateAction<PanelImperativeHandle | null>>;
  onResize: () => void;
  onDrag: () => void;
  api: WorkspacePanelAPI;
};

export const useWorkspacePanel: UseWorkspacePanel = ({
  storageKey,
  defaultSize,
  sibling,
}) => {
  const [panel, setRef] = usePanelCallbackRef();

  const [isCollapsed, setIsCollapsed] = useState(
    () => panel?.isCollapsed() || false,
  );

  // Maximized logic not provided by the library
  const [isMaximized, setIsMaximized] = useState(false);
  const prevSizeBeforeMaximize = useRef<number | null>(null);

  const { storedSize, setStoredSize } = usePanelPersistence(storageKey);

  const toggleCollapsed = useCallback(() => {
    if (!panel) {
      return;
    }

    if (panel.isCollapsed()) {
      panel.expand();
      setIsCollapsed(false);
    } else {
      panel.collapse();
      setIsCollapsed(true);
    }
  }, [panel]);

  const toggleMaximize = useCallback(() => {
    if (!panel) {
      return;
    }

    if (isMaximized) {
      let restoreSize = prevSizeBeforeMaximize.current;
      // Ignore a stored previous size that is itself a maximized size,
      // otherwise "un-maximize" would just toggle max → max.
      if (!restoreSize || isMaxSizePx(restoreSize, panel, sibling?.minSizePx)) {
        restoreSize = defaultSize || 100;
      }
      panel.resize(restoreSize);
    } else {
      const currentSize = panel.getSize().inPixels;
      prevSizeBeforeMaximize.current = currentSize;
      panel.resize('100%');
    }
  }, [panel, isMaximized, defaultSize, sibling?.minSizePx]);

  const onResize = useCallback(() => {
    if (!panel) {
      return;
    }
    setIsCollapsed(panel.isCollapsed());
    setIsMaximized(isPanelMaximized(panel, sibling?.minSizePx));
    setStoredSize(panel.getSize().inPixels);
  }, [panel, setStoredSize, sibling?.minSizePx]);

  const onDrag = useCallback(() => {
    prevSizeBeforeMaximize.current = null;
  }, []);

  return {
    panel,
    setRef,
    onResize,
    onDrag,
    storedSize,
    api: {
      toggleCollapsed,
      isCollapsed,
      toggleMaximize,
      isMaximized,
    },
  };
};
