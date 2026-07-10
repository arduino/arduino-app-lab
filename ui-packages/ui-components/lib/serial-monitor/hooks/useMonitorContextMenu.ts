import { writeText } from '@bcmi-labs/cloud-editor-domain/src/services/services-by-app/app-lab';
import { selectAll } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEvent as useEventListener } from 'react-use';

import { ContextMenuItemIds } from '../../context-menu/contextMenu.type';

type MonitorContextMenuHandlerDictionary = Partial<
  Record<ContextMenuItemIds, () => void | Promise<void>>
>;

type UseMonitorContextMenu = (viewInstance: EditorView | null) => {
  onContextMenuClose: (e: KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  clickHandlers: MonitorContextMenuHandlerDictionary;
  disabledKeys: ContextMenuItemIds[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const useMonitorContextMenu: UseMonitorContextMenu = function (
  viewInstance: EditorView | null,
): ReturnType<UseMonitorContextMenu> {
  const [isOpen, setIsOpen] = useState(false);
  const [disabledKeys, setDisabledKeys] = useState<ContextMenuItemIds[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isActiveRef = useRef(false);

  const clickHandlers: MonitorContextMenuHandlerDictionary = {
    [ContextMenuItemIds.Copy]: async (): Promise<void> => {
      if (!viewInstance) return;

      const selectedText = viewInstance.state.sliceDoc(
        viewInstance.state.selection.main.from,
        viewInstance.state.selection.main.to,
      );

      if (selectedText) {
        await writeText(selectedText);
      }
    },
    [ContextMenuItemIds.SelectAll]: (): void => {
      if (viewInstance) {
        selectAll({
          state: viewInstance.state,
          dispatch: viewInstance.dispatch,
        });
      }
    },
  };

  useEffect(() => {
    async function setKeys(): Promise<void> {
      const keys: ContextMenuItemIds[] = [];

      if (!viewInstance) {
        keys.push(ContextMenuItemIds.Copy, ContextMenuItemIds.SelectAll);
      } else {
        // Check if there's selected text
        const selectedText = viewInstance.state.sliceDoc(
          viewInstance.state.selection.main.from,
          viewInstance.state.selection.main.to,
        );

        // Only disable Copy if there's no selected text
        if (!selectedText) {
          keys.push(ContextMenuItemIds.Copy);
        }
        // Select All should always be enabled if there's a view instance
      }

      setDisabledKeys(keys);
    }

    if (isOpen) {
      setKeys();
    }
  }, [isOpen, viewInstance]);

  const closeContextMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const onContextMenuClose = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    },
    [closeContextMenu],
  );

  const handlePointerDown = useCallback((e: Event) => {
    const container = containerRef.current;
    isActiveRef.current = !!(container && container.contains(e.target as Node));
  }, []);

  const handleKeyDown = useCallback(
    (event: Event) => {
      const e = event as KeyboardEvent;
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === 'a' &&
        viewInstance &&
        isActiveRef.current
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        clickHandlers[ContextMenuItemIds.SelectAll]?.();
      }
    },
    [viewInstance, clickHandlers],
  );

  useEventListener('keydown', onContextMenuClose);
  useEventListener('mousedown', handlePointerDown, document, true);
  useEventListener('keydown', handleKeyDown, document, true);

  return {
    onContextMenuClose,
    containerRef,
    clickHandlers,
    disabledKeys,
    isOpen,
    setIsOpen,
  };
};
