import {
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import clsx from 'clsx';
import {
  Key,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { AddTab, ChatAgent, ChevronDown, SplitView } from '../assets/icons';
import { setCSSVariable } from '../common/utils';
import { useEditorComponents } from '../editor-components';
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
   * Panel this tabs bar belongs to. When provided alongside a
   * SplitDragProvider, tab drags will report this as the drag's origin
   * panel so cross-panel drop zones can dispatch Move semantics.
   */
  panelId?: 'A' | 'B';
  classes?: { container?: string; selected?: string; tab?: string };
  /**
   * Toggles split view. Rendered here (rather than as the standalone
   * absolutely-positioned overlay panel B still uses for its own disabled
   * icon) so it sits in the same flex row as `agentPanel` below instead of
   * floating on top of it — per Figma, split-view precedes the agent icon.
   */
  splitToggle?: {
    label: string;
    /** Panel B renders this as a static, non-interactive mirror icon. */
    disabled?: boolean;
    onToggle: VoidFunction;
  };
  /**
   * Toggles the agent side panel. Lives in this bar's own `.tabs-bar-right`
   * flex area (not an absolutely-positioned overlay) so it stays visible
   * and non-overlapping when the panel narrows in split view.
   */
  agentPanel?: {
    label: string;
    isOpen?: boolean;
    onToggle: VoidFunction;
  };
}

/**
 * Hit-tests a pointer position against this bar's rendered tab elements
 * (identified by their `data-file-id` attribute, in DOM = tab order) and
 * returns the would-be insertion point for a tab dragged from the other
 * panel's bar, or null when the pointer is not over the bar. Takes the bar
 * rather than the tabs list, so the strip beyond the last tab — which the
 * list stops covering once it shrink-wraps — still drops at the end.
 */
function getCrossPanelInsertion(
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
// right at the edge. Lets a cross-panel drag reach tabs that are scrolled
// out of view.
const DRAG_AUTOSCROLL_EDGE = 48;
const DRAG_AUTOSCROLL_MAX_SPEED = 14;

const EditorTabsBar: React.FC<EditorTabsBarProps> = (
  props: EditorTabsBarProps,
) => {
  const { tabsBarLogic, classes, panelId, splitToggle, agentPanel } = props;
  const { IconButton } = useEditorComponents();
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
    onCrossPanelDrop,
  } = tabsBarLogic();

  const inputRef = useRef<HTMLInputElement>(null);
  const tabsBarRef = useRef<HTMLDivElement>(null);
  const scrollTabsRef = useRef<HTMLUListElement>(null);
  const renameTabRef = useRef<HTMLLIElement>(null);
  const splitDragCtx = useSplitDrag();
  const splitDragPointer = useSplitDragPointer();

  // True while a tab from the OTHER panel's bar is being dragged.
  const hasForeignTabDrag = Boolean(
    panelId &&
      splitDragCtx?.payload &&
      splitDragCtx.payload.originPanel !== panelId,
  );

  // Insertion indicator for a foreign tab hovering this bar — same per-tab
  // highlight as intra-bar reorder. Purely derived from the shared drag
  // payload + pointer, so cancel/exit cleanup is implicit: endDrag clears
  // both and the indicator disappears with them.
  const crossPanelIndicator = useMemo(() => {
    if (!hasForeignTabDrag || !splitDragPointer || !tabsBarRef.current) {
      return null;
    }
    return getCrossPanelInsertion(tabsBarRef.current, splitDragPointer);
  }, [hasForeignTabDrag, splitDragPointer]);

  // True while one of THIS bar's tabs is being dragged.
  const hasOwnTabDrag = Boolean(
    panelId &&
      splitDragCtx?.payload &&
      splitDragCtx.payload.originPanel === panelId,
  );

  // dnd-kit's lenient collision strategy keeps `over` (and with it the
  // reorder indicator) alive when the pointer drifts outside the bar —
  // deliberate, so slightly sloppy horizontal drags still reorder. But
  // once the pointer is past the bar horizontally (the other panel's
  // territory) or well below it (the editor body / cross-panel drop
  // zones), a drop no longer reorders this bar, so the lingering
  // indicator would advertise a drop position that doesn't exist. One
  // bar-height of vertical slack preserves the sloppy-reorder tolerance.
  const ownIndicatorStale = useMemo(() => {
    if (!hasOwnTabDrag || !splitDragPointer || !tabsBarRef.current) {
      return false;
    }
    const rect = tabsBarRef.current.getBoundingClientRect();
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
    if (!ctx || !panelId || !onCrossPanelDrop) return undefined;
    ctx.registerTabsBarDropTarget(panelId, {
      getInsertionIndex: (pointer): number | null =>
        tabsBarRef.current
          ? getCrossPanelInsertion(tabsBarRef.current, pointer)?.insertIndex ??
            null
          : null,
      commit: (payload, insertIndex): void =>
        onCrossPanelDrop(payload.fileId, insertIndex),
    });
    return (): void => ctx.registerTabsBarDropTarget(panelId, null);
  }, [splitDragCtx, panelId, onCrossPanelDrop]);

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
      splitDragCtx && panelId
        ? {
            onStart: (fileId): void =>
              splitDragCtx.startDrag({ fileId, originPanel: panelId }),
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

  const renderTabNodes = (): ReactElement => {
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
                classes={classes}
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
                    : crossPanelIndicator?.tabId === tab.fileId
                    ? crossPanelIndicator.direction
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

  const renderCreateTabNode = (): ReactElement => {
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
      ref={tabsBarRef}
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
        {(splitToggle || agentPanel) && (
          <div className={styles['tabs-bar-actions']}>
            {splitToggle && (
              <IconButton
                label={splitToggle.label}
                Icon={SplitView}
                isDisabled={splitToggle.disabled}
                onPress={splitToggle.onToggle}
              />
            )}
            {agentPanel && (
              // The agent works on the file of the active panel, so opening it
              // must not switch panels. The marker sits on a wrapper because an
              // injected IconButton takes only the contract's props.
              <span
                data-keeps-active-editor-panel
                className={styles['tabs-bar-action']}
              >
                <IconButton
                  label={agentPanel.label}
                  Icon={ChatAgent}
                  isPressed={agentPanel.isOpen ?? false}
                  onPress={agentPanel.onToggle}
                />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorTabsBar;
