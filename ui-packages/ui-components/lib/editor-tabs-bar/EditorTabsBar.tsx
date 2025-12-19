import { setCSSVariable } from '@cloud-editor-mono/common';
import { AddTab, ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import clsx from 'clsx';
import { Key, useCallback, useEffect, useRef, useState } from 'react';
import { MenuTriggerState } from 'react-stately';
import { useScroll } from 'react-use';
import useMeasureDirty from 'react-use/lib/useMeasureDirty';

import DropdownMenuButton from '../essential/dropdown-menu/DropdownMenuButton';
import { FilterableListButton } from '../essential/filterable-list/FilterableListButton';
import {
  FileExtension,
  SUPPORTED_TYPES,
  TabsBarLogic,
} from './EditorTabsBar.type';
import { useTabsBar } from './hooks/useTabsBar';
import EditorTab from './sub-components/EditorTab';
import { newTabMenuSections } from './sub-components/editorTabMenuSpec';
import RenameEditorTab, {
  RenameTabRole,
} from './sub-components/RenameEditorTab';
import styles from './tabs-bar.module.scss';

interface EditorTabsBarProps {
  tabsBarLogic: TabsBarLogic;
  classes?: { container?: string; selected?: string; tab?: string };
}

const EditorTabsBar: React.FC<EditorTabsBarProps> = (
  props: EditorTabsBarProps,
) => {
  const { tabsBarLogic, classes } = props;
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
    hasSetHeightOnHover,
    addFile,
    renameFile,
    deleteFile,
    validateFileName,
    replaceFileNameInvalidCharacters,
    onBeforeFileAction,
    dispatchNewFileAction,
    setDispatchNewFileAction,
    isRenderedMarkdownFile,
  } = tabsBarLogic();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollTabsRef = useRef<HTMLUListElement>(null);
  const renameTabRef = useRef<HTMLLIElement>(null);
  const tabsRef = useRef<{
    [fileId: string]: HTMLLIElement;
  }>({});

  const [tabsListScrollable, setTabsListScrollable] = useState(false);

  const [, setOpenMenuMap] = useState<Map<string, MenuTriggerState>>(new Map());

  const { x: scrollTabsLeft } = useScroll(scrollTabsRef);

  const measure = useMeasureDirty(scrollTabsRef);

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
  } = useTabsBar(
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
  );

  // Delay pointer sensor event to not override other pointer interactions by dragging
  // eg. button click, context menu
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 1,
    },
  });
  const sensors = useSensors(
    pointerSensor,
    useSensor(KeyboardSensor),
    useSensor(TouchSensor),
  );

  useEffect(() => {
    if (scrollTabsRef.current) {
      setTabsListScrollable(
        Math.round(measure.width) < scrollTabsRef.current.scrollWidth,
      );
    }
  }, [tabs.length, measure.width]);

  useEffect(() => {
    const ref = tabsRef.current[selectedTab?.fileId || ''];
    ref?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedTab]);

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

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    const prevIndex = active.data.current?.sortable.index;
    const newIndex = over?.data.current?.sortable.index;
    if (prevIndex !== newIndex) {
      const newTabList = arrayMove(tabs, prevIndex, newIndex);
      updateTabOrder(newTabList.map((tab) => tab.fileId));
    }
  };

  const renderTabNodes = (): JSX.Element => {
    const items = tabs.map((t) => ({ ...t, id: t.fileId }));

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToHorizontalAxis]}
      >
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          {items.map((item) => {
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
              <EditorTab
                ref={(tabRef): void => {
                  if (tabRef) {
                    tabsRef.current[tab.fileId] = tabRef as HTMLLIElement;
                  }
                }}
                id={id}
                key={id}
                tabData={tab}
                isSelected={selectedTab?.fileId === tab.fileId}
                Icon={tab.Icon}
                dataIsLoading={sketchDataIsLoading}
                isMainFile={tab.fileId === selectableMainFile?.fileId}
                isUnsaved={Boolean(
                  tab.fileId && unsavedFileIds?.has(tab.fileId),
                )}
                classes={{ selected: classes?.selected, tab: classes?.tab }}
                selectTab={onTabClick}
                isReadOnly={isReadOnly || !!tab.isMetadataReadOnly}
                tabAction={tabAction}
                setOpenMenuMap={setOpenMenuMap}
              />
            );
          })}
        </SortableContext>
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
    if (tabsListScrollable) {
      return {
        name: 'tabs-list',
        items: tabs.map((tab) => ({
          id: tab.fileId,
          label: {
            id: `tabList.${tab.fileId}`,
            defaultMessage: `${tab.fileName}`,
            description: `Tab file name: ${tab.fileName}`,
          },
          labelPrefix: <div>{tab.Icon ? <tab.Icon /> : null}</div>,
        })),
      };
    }
  }, [tabs, tabsListScrollable]);

  const onFilterableListAction = useCallback(
    (key: Key): void => {
      const tab = tabs.find((tab) => tab.fileId === key);
      if (tab) {
        onTabClick(tab);

        const ref = tabsRef.current[tab.fileId];
        ref.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    },
    [tabs, onTabClick],
  );

  const renameTabIndex = tabs.findIndex((tab) => tab.fileId === renamingFileId);

  setCSSVariable(styles.tabsBarListScrollLeft, `${scrollTabsLeft}`);
  setCSSVariable(styles.renameTabIndex, `${renameTabIndex}`);
  setCSSVariable(styles.tabsSize, `${!sketchDataIsLoading ? tabs.length : 1}`);

  return (
    <div
      className={clsx(styles['tabs-bar'], classes?.container, {
        [styles['tabs-bar-markdown-file']]: isRenderedMarkdownFile,
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
          [styles['tabs-list-scrollable']]: tabsListScrollable,
          [styles['tabs-list-height-exception']]:
            hasSetHeightOnHover && tabsListScrollable,
        })}
      >
        {!sketchDataIsLoading && tabs.length ? (
          !isNewTabAdded ? (
            renderTabNodes()
          ) : (
            <>
              {renderTabNodes()}
              {renderCreateTabNode()}
            </>
          )
        ) : (
          <EditorTab
            isSelected={true}
            dataIsLoading={!!sketchDataIsLoading}
            isReadOnly={isReadOnly}
          />
        )}
      </ul>
      {tabsListScrollable ? (
        <FilterableListButton
          buttonChildren={<ChevronDown />}
          getSections={getFilterableListSections}
          label={'Search tabs'}
          onAction={onFilterableListAction}
          classes={{
            wrapper: styles['filterable-list-button-wrapper'],
            button: styles['new-tab-menu-button'],
            listContainer: styles['filterable-list-container'],
          }}
        />
      ) : null}
      {!isReadOnly ? (
        <DropdownMenuButton
          buttonChildren={<AddTab />}
          sections={newTabMenuSections}
          onAction={newTabMenuAction}
          classes={{
            dropdownMenuButtonWrapper: clsx(
              styles['new-tab-menu-button-wrapper'],
              {
                [styles['filterable-list-button-wrapper-visible']]:
                  tabsListScrollable,
              },
            ),
            dropdownMenuButton: styles['new-tab-menu-button'],
            dropdownMenu: styles['new-tab-menu'],
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
    </div>
  );
};

export default EditorTabsBar;
