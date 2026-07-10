import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react';
import {
  PanelImperativeHandle,
  usePanelCallbackRef,
} from 'react-resizable-panels';

export interface WorkspacePanelAPI {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  isMaximized: boolean;
  toggleMaximize: () => void;
}

export type UseWorkspacePanel = (params?: {
  id?: string;
  defaultSize?: number;
}) => {
  panel: PanelImperativeHandle | null;
  storedSize?: number;
  setRef: Dispatch<SetStateAction<PanelImperativeHandle | null>>;
  onResize: () => void;
  onDrag: () => void;
  api: WorkspacePanelAPI;
};

export const useWorkspacePanel: UseWorkspacePanel = ({ defaultSize } = {}) => {
  const [panel, setRef] = usePanelCallbackRef();

  const [isCollapsed, setIsCollapsed] = useState(
    () => panel?.isCollapsed() || false,
  );

  // Maximized logic not provided by the library
  const [isMaximized, setIsMaximized] = useState(false);
  const prevSizeBeforeMaximize = useRef<number | null>(null);

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
      let prevSize = prevSizeBeforeMaximize.current;

      const currSize = panel.getSize().inPixels;
      if (prevSize && prevSize >= currSize) {
        // If container was resized while panel was maximized and the previous size is bigger
        // than the current size, restore to the current size to avoid precision issues
        prevSize = null;
      }

      panel.resize(prevSizeBeforeMaximize.current || defaultSize || 100);
    } else {
      const size = panel.getSize();
      if (size.asPercentage < 98) {
        // If the panel is already taking most of the space,
        // maximize it without storing the previous size to avoid precision issues when restoring
        prevSizeBeforeMaximize.current = size.inPixels;
      }
      panel.resize('100%');
    }
  }, [panel, isMaximized, defaultSize]);

  const onResize = useCallback(() => {
    if (!panel) {
      return;
    }
    setIsCollapsed(panel.isCollapsed());

    const size = panel.getSize();
    const otherPanelPx =
      (size.inPixels * (100 - size.asPercentage)) / size.asPercentage;
    setIsMaximized(otherPanelPx <= 41);
  }, [panel]);

  const onDrag = useCallback(() => {
    prevSizeBeforeMaximize.current = null;
  }, []);

  return {
    panel,
    setRef,
    onResize,
    onDrag,
    api: {
      toggleCollapsed,
      isCollapsed,
      toggleMaximize,
      isMaximized,
    },
  };
};
