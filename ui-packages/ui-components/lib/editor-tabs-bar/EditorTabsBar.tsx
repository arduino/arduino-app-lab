import { setCSSVariable } from '@cloud-editor-mono/common';
import { AddTab, ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { Key, useCallback, useEffect, useMemo, useRef } from 'react';

import {
  useSplitDrag,
  useSplitDragPointer,
} from '../editor-panel/SplitDragContext';
import DropdownMenuButton from '../essential/dropdown-menu/DropdownMenuButton';
import FilterableListButton from '../essential/filterable-list/FilterableListButton';
import {
  FileExtension,
  SUPPORTED_TYPES,
  TabsBarLogic,
} from './EditorTabsBar.type';
import { useTabsBarActions } from './hooks/useTabsBarActions';
import {
  useTabsBarReorder,
  verticalColumnCollisionStrategy,
} from './hooks/useTabsBarReorder';
import { useTabsBarScroll } from './hooks/useTabsBarScroll';
import EditorTab from './sub-components/EditorTab';
import { newTabMenuSections } from './sub-components/editorTabMenuSpec';
import RenameEditorTab, {
  RenameTabRole,
} from './sub-components/RenameEditorTab';
import SortableEditorTab from './sub-components/SortableEditorTab';
import styles from './tabs-bar.module.scss';

interface EditorTabsBarProps {
  tabsBarLogic: TabsBarLogic;
  /**
   * Pane this tabs bar belongs to. When provided alongside a
   * SplitDragProvider, tab drags will report this as the drag's origin
   * pane so cross-pane drop zones can dispatch Move semantics.
   */
  paneId?: 'A' | 'B';
  classes?: { container?: string; selected?: string; tab?: string };
}

/**
 * Hit-tests a pointer position against this bar's rendered tab elements
 * (identified by their `data-file-id` attribute, in DOM = tab order) and
 * returns the would-be insertion point for a tab dragged from the other
 * pane's bar, or null when the pointer is not over the bar.
 */
function getCrossPaneInsertion(
  barEl: HTMLElement,
  pointer: { x: number; y: number },
): { tabId: string; direction: 'left' | 'right'; insertIndex: number } | null {
  const barRect = barEl.getBoundingClientRect();
  if (
    pointer.x < barRect.left ||
    pointer.x > barRect.right ||
    pointer.y < barRect.top ||
    pointer.y > barRect.bottom
  ) {
    return null;
  }
  const tabEls = Array.from(
    barEl.querySelectorAll<HTMLElement>('[data-file-id]'),
  );
  if (tabEls.length === 0) return null;
  for (let i = 0; i < tabEls.length; i++) {
    const rect = tabEls[i].getBoundingClientRect();
    if (pointer.x <= rect.right) {
      const direction =
        pointer.x < rect.left + rect.width / 2 ? 'left' : 'right';
      return {
        tabId: tabEls[i].dataset.fileId ?? '',
        direction,
        insertIndex: direction === 'left' ? i : i + 1,
      };
    }
  }
  // Pointer past the last tab — insert at the end.
  return {
    tabId: tabEls[tabEls.length - 1].dataset.fileId ?? '',
    direction: 'right',
    insertIndex: tabEls.length,
  };
}

// Distance (px) from each edge of the tabs bar within which a foreign tab
// drag triggers auto-scroll, and the max scroll speed (px/frame) applied
// right at the edge. Lets a cross-pane drag reach tabs that are scrolled
// out of view.
const DRAG_AUTOSCROLL_EDGE = 48;
const DRAG_AUTOSCROLL_MAX_SPEED = 14;

const EditorTabsBar: React.FC<EditorTabsBarProps> = (
  props: EditorTabsBarProps,
) => {
  const { tabsBarLogic, classes, paneId } = props;
  const {
    tabs,
    selectableMainFile,
    selectedTab,
    selectTab,
    selectSecretsTab,
    closeTab,
    updateTabOrder,
    sketchDataIsLoading,
    unsavedFileIds,
    makeUniqueFileName,
    getFileIcon,
    isReadOnly,
    previewFileId,
    addFile,
    renameFile,
    deleteFile,
    validateFileName,
    replaceFileNameInvalidCharacters,
    onBeforeFileAction,
    dispatchNewFileAction,
    setDispatchNewFileAction,
    showFileSearch,
    onSplitRight,
    onSplitLeft,
    onCloseAll,
    onCrossPaneDrop,
  } = tabsBarLogic();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollTabsRef = useRef<HTMLUListElement>(null);
  const renameTabRef = useRef<HTMLLIElement>(null);
  const splitDragCtx = useSplitDrag();
  const splitDragPointer = useSplitDragPointer();

  // True while a tab from the OTHER pane's bar is being dragged.
  const hasForeignTabDrag = Boolean(
    paneId &&
      splitDragCtx?.payload &&
      splitDragCtx.payload.originPane !== paneId,
  );

  // Insertion indicator for a foreign tab hovering this bar — same per-tab
  // highlight as intra-bar reorder. Purely derived from the shared drag
  // payload + pointer, so cancel/exit cleanup is implicit: endDrag clears
  // both and the indicator disappears with them.
  const crossPaneIndicator = useMemo(() => {
    if (!hasForeignTabDrag || !splitDragPointer || !scrollTabsRef.current) {
      return null;
    }
    return getCrossPaneInsertion(scrollTabsRef.current, splitDragPointer);
  }, [hasForeignTabDrag, splitDragPointer]);

  // True while one of THIS bar's tabs is being dragged.
  const hasOwnTabDrag = Boolean(
    paneId &&
      splitDragCtx?.payload &&
      splitDragCtx.payload.originPane === paneId,
  );

  // dnd-kit's lenient collision strategy keeps `over` (and with it the
  // reorder indicator) alive when the pointer drifts outside the bar —
  // deliberate, so slightly sloppy horizontal drags still reorder. But
  // once the pointer is past the bar horizontally (the other pane's
  // territory) or well below it (the editor body / cross-pane drop
  // zones), a drop no longer reorders this bar, so the lingering
  // indicator would advertise a drop position that doesn't exist. One
  // bar-height of vertical slack preserves the sloppy-reorder tolerance.
  const ownIndicatorStale = useMemo(() => {
    if (!hasOwnTabDrag || !splitDragPointer || !scrollTabsRef.current) {
      return false;
    }
    const rect = scrollTabsRef.current.getBoundingClientRect();
    const verticalSlack = rect.height;
    return (
      splitDragPointer.x < rect.left ||
      splitDragPointer.x > rect.right ||
      splitDragPointer.y < rect.top - verticalSlack ||
      splitDragPointer.y > rect.bottom + verticalSlack
    );
  }, [hasOwnTabDrag, splitDragPointer]);

  // Register this bar as a positional drop target for foreign tab drags.
  useEffect(() => {
    const ctx = splitDragCtx;
    if (!ctx || !paneId || !onCrossPaneDrop) return undefined;
    ctx.registerTabsBarDropTarget(paneId, {
      getInsertionIndex: (pointer): number | null =>
        scrollTabsRef.current
          ? getCrossPaneInsertion(scrollTabsRef.current, pointer)
              ?.insertIndex ?? null
          : null,
      commit: (payload, insertIndex): void =>
        onCrossPaneDrop(payload.fileId, insertIndex),
    });
    return (): void => ctx.registerTabsBarDropTarget(paneId, null);
  }, [splitDragCtx, paneId, onCrossPaneDrop]);

  // Auto-scroll this bar while a foreign tab is dragged near its edges so
  // tabs scrolled out of view become reachable as drop targets. The
  // pointer is read from a ref inside a rAF loop so the loop isn't torn
  // down and rebuilt on every per-frame pointer update.
  const splitDragPointerRef = useRef(splitDragPointer);
  splitDragPointerRef.current = splitDragPointer;
  useEffect(() => {
    if (!hasForeignTabDrag) return undefined;
    const el = scrollTabsRef.current;
    if (!el) return undefined;
    let raf = 0;
    const step = (): void => {
      const pointer = splitDragPointerRef.current;
      if (pointer) {
        const rect = el.getBoundingClientRect();
        const withinBar =
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom &&
          pointer.x >= rect.left - DRAG_AUTOSCROLL_EDGE &&
          pointer.x <= rect.right + DRAG_AUTOSCROLL_EDGE;
        if (withinBar) {
          const fromLeft = pointer.x - rect.left;
          const fromRight = rect.right - pointer.x;
          if (fromLeft < DRAG_AUTOSCROLL_EDGE) {
            const intensity = Math.min(
              1,
              (DRAG_AUTOSCROLL_EDGE - fromLeft) / DRAG_AUTOSCROLL_EDGE,
            );
            el.scrollLeft -= intensity * DRAG_AUTOSCROLL_MAX_SPEED;
          } else if (fromRight < DRAG_AUTOSCROLL_EDGE) {
            const intensity = Math.min(
              1,
              (DRAG_AUTOSCROLL_EDGE - fromRight) / DRAG_AUTOSCROLL_EDGE,
            );
            el.scrollLeft += intensity * DRAG_AUTOSCROLL_MAX_SPEED;
          }
        }
      }
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return (): void => window.cancelAnimationFrame(raf);
  }, [hasForeignTabDrag]);

  const {
    filePath,
    newTabMenuAction,
    tabAction,
    addNewTab,
    renameTab,
    handleImportedFile,
    onTabClick,
    isNewTabAdded,
    newTabActionType,
    renamingFileId,
  } = useTabsBarActions(
    tabs,
    selectedTab,
    selectableMainFile,
    inputRef,
    selectTab,
    selectSecretsTab,
    closeTab,
    addFile,
    renameFile,
    deleteFile,
    makeUniqueFileName,
    replaceFileNameInvalidCharacters,
    onBeforeFileAction,
    onSplitRight,
    onSplitLeft,
    onCloseAll,
  );

  const {
    activeTab,
    dropIndicator,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = useTabsBarReorder({
    tabs,
    updateTabOrder,
    splitDrag:
      splitDragCtx && paneId
        ? {
            onStart: (fileId): void =>
              splitDragCtx.startDrag({ fileId, originPane: paneId }),
            onMove: (coords): void => splitDragCtx.updatePointer(coords),
            onEnd: (): boolean => {
              const consumed = splitDragCtx.finishDragAtPointer();
              splitDragCtx.endDrag();
              return consumed;
            },
            // Aborted drags (Escape) tear down without committing a drop.
            onCancel: (): void => splitDragCtx.endDrag(),
          }
        : undefined,
  });

  const { isScrollable } = useTabsBarScroll({
    scrollRef: scrollTabsRef,
    selectedFileId: selectedTab?.fileId,
  });

  useEffect(() => {
    if (renamingFileId && renameTabRef.current) {
      renameTabRef.current.scrollIntoView();
    }
  }, [renamingFileId]);

  useEffect(() => {
    if (dispatchNewFileAction && setDispatchNewFileAction) {
      newTabMenuAction(dispatchNewFileAction);
      setDispatchNewFileAction(null);
    }
  }, [newTabMenuAction, dispatchNewFileAction, setDispatchNewFileAction]);

  const renderTabNodes = (): JSX.Element => {
    const items = tabs.map((t) => ({ ...t, id: t.fileId }));

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={verticalColumnCollisionStrategy}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={items}>
          {items.map((item, index) => {
            const { id, ...tab } = item;

            return !isReadOnly && tab.fileId === renamingFileId ? (
              <RenameEditorTab
                ref={renameTabRef}
                key={id}
                fileId={tab.fileId}
                fileName={
                  tab.fileName ??
                  makeUniqueFileName(`Untitled`, tab.fileExtension ?? '')
                }
                fileExtension={tab.fileExtension}
                Icon={getFileIcon(tab.fileExtension)}
                isSelected={selectedTab?.fileId === tab.fileId}
                tabAction={{ role: RenameTabRole.Rename, handler: renameTab }}
                validateFileName={validateFileName}
                replaceFileNameInvalidCharacters={
                  replaceFileNameInvalidCharacters
                }
              />
            ) : (
              <SortableEditorTab
                id={id}
                key={id}
                tabData={tab}
                isPreview={tab.fileId === previewFileId}
                isSelected={selectedTab?.fileId === tab.fileId}
                Icon={tab.Icon}
                dataIsLoading={sketchDataIsLoading}
                isMainFile={tab.fileId === selectableMainFile?.fileId}
                tabIndex={index}
                tabsCount={items.length}
                isUnsaved={Boolean(
                  tab.fileId && unsavedFileIds?.has(tab.fileId),
                )}
                selectTab={onTabClick}
                isReadOnly={isReadOnly || !!tab.isMetadataReadOnly}
                tabAction={tabAction}
                hideSplitRight={!onSplitRight}
                hideSplitLeft={!onSplitLeft}
                dropIndicator={
                  !ownIndicatorStale && dropIndicator?.tabId === tab.fileId
                    ? dropIndicator.direction
                    : crossPaneIndicator?.tabId === tab.fileId
                    ? crossPaneIndicator.direction
                    : undefined
                }
              />
            );
          })}
        </SortableContext>
        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: '0.5' } },
            }),
          }}
        >
          {activeTab ? (
            <EditorTab
              tabData={activeTab}
              isSelected={activeTab.fileId === selectedTab?.fileId}
              Icon={activeTab.Icon}
              classes={{ tab: styles['tab-drag-overlay'] }}
              isReadOnly={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  const renderCreateTabNode = (): JSX.Element => {
    const ext =
      newTabActionType !== undefined
        ? FileExtension[newTabActionType as keyof typeof FileExtension]
        : '';
    return (
      <RenameEditorTab
        ref={renameTabRef}
        key={filePath + makeUniqueFileName(`Untitled`, ext)}
        fileName={makeUniqueFileName(`Untitled`, ext)}
        fileExtension={ext}
        Icon={getFileIcon(ext)}
        isSelected={true}
        tabAction={{ role: RenameTabRole.Create, handler: addNewTab }}
        validateFileName={validateFileName}
        replaceFileNameInvalidCharacters={replaceFileNameInvalidCharacters}
      />
    );
  };

  const getFilterableListSections = useCallback(() => {
    return {
      name: 'tabs-list',
      items: tabs.map((tab) => ({
        id: tab.fileId,
        label: {
          id: `tabList.${tab.fileId}`,
          defaultMessage: `${tab.fileName}`,
          description: `Tab file name: ${tab.fileName}`,
        },
        labelPrefix: <div>{tab.Icon}</div>,
      })),
    };
  }, [tabs]);

  const onFilterableListAction = useCallback(
    (key: Key): void => {
      const tab = tabs.find((tab) => tab.fileId === key);
      if (tab) {
        onTabClick({ tab });
      }
    },
    [tabs, onTabClick],
  );

  const renameTabIndex = tabs.findIndex((tab) => tab.fileId === renamingFileId);

  setCSSVariable(styles.renameTabIndex, `${renameTabIndex}`);

  return (
    <div
      className={clsx(styles['tabs-bar'], classes?.container, {
        [styles['tabs-bar-scrollable']]: isScrollable,
      })}
    >
      <ul
        ref={scrollTabsRef}
        className={clsx(styles['tabs-list'], {
          [styles['first-tab-renaming']]: renameTabIndex === 0,
          [styles['other-tabs-renaming']]:
            renameTabIndex > 0 && renameTabIndex < tabs.length - 1,
          [styles['last-tab-renaming']]:
            tabs.length > 0 && renameTabIndex === tabs.length - 1,
          [styles['new-tab-renaming']]: isNewTabAdded,
        })}
      >
        {!sketchDataIsLoading && tabs.length ? (
          <>
            {renderTabNodes()}
            {isNewTabAdded && renderCreateTabNode()}
          </>
        ) : (
          <EditorTab
            isSelected={true}
            dataIsLoading={!!sketchDataIsLoading}
            isReadOnly={isReadOnly}
          />
        )}
      </ul>
      <div className={styles['tabs-bar-right']}>
        {!isReadOnly ? (
          <DropdownMenuButton
            buttonChildren={<AddTab />}
            sections={newTabMenuSections}
            onAction={newTabMenuAction}
            classes={{
              dropdownMenuButtonWrapper: styles['tabs-bar-right-item'],
              dropdownMenuButton: styles['tabs-bar-right-button'],
              dropdownMenu: styles['tabs-bar-right-menu'],
              dropdownMenuItem: styles['new-tab-menu-item'],
            }}
          />
        ) : null}
        <input
          type="file"
          onChange={handleImportedFile}
          ref={inputRef}
          accept={SUPPORTED_TYPES.join(',')}
          className={styles['import-file-input']}
        />
        {isScrollable && showFileSearch && (
          <FilterableListButton
            buttonChildren={<ChevronDown />}
            getSections={getFilterableListSections}
            label={'Search tabs'}
            onAction={onFilterableListAction}
            classes={{
              wrapper: styles['tabs-bar-right-item'],
              button: styles['tabs-bar-right-button'],
              listContainer: styles['tabs-bar-right-menu'],
            }}
          />
        )}
      </div>
    </div>
  );
};

export default EditorTabsBar;
