import { CloseX, UnsavedBadge } from '@cloud-editor-mono/images/assets/icons';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import { Key, memo, useCallback, useState } from 'react';

import { IconButton } from '../../essential/icon-button';
import { WrapperTitle } from '../../essential/wrapper-title';
import { useI18n } from '../../i18n/useI18n';
import { Skeleton } from '../../skeleton';
import { XXSmall } from '../../typography';
import {
  NewTabMenuItemIds,
  SelectableFileData,
  TabMenuItemIds,
} from '../EditorTabsBar.type';
import styles from './editor-tab.module.scss';
import { tabMenuSections } from './editorTabMenuSpec';

export interface EditorTabProps {
  id?: string;
  tabData?: SelectableFileData;
  Icon?: React.ReactNode;
  isSelected: boolean;
  isPreview?: boolean;
  selectTab?: (params: {
    tab: SelectableFileData;
    event?: React.MouseEvent<HTMLElement, MouseEvent>;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  dataIsLoading?: boolean;
  isMainFile?: boolean;
  tabAction?: (
    key: TabMenuItemIds | NewTabMenuItemIds,
    fileId: string,
    tabIndex?: number,
  ) => void;
  tabIndex?: number;
  tabsCount?: number;
  isUnsaved?: boolean;
  deleteFile?: () => void;
  isReadOnly: boolean;
  hideSplitRight?: boolean;
  hideSplitLeft?: boolean;
  classes?: { selected?: string; tab?: string };
}

const EditorTab = (props: EditorTabProps): React.ReactElement => {
  const {
    tabData,
    Icon,
    isSelected,
    isPreview,
    selectTab,
    dataIsLoading,
    isUnsaved,
    tabAction,
    tabIndex,
    tabsCount,
    isReadOnly,
    hideSplitRight,
    hideSplitLeft,
    classes,
  } = props;

  const { formatMessage } = useI18n();
  const [closeTooltipVisible, setCloseTooltipVisible] = useState(false);
  // Bumped on every tabAction so the hover tooltip remounts and clears its
  // internal show-state — without this, Split/Move/etc. leave a stale tooltip
  // because the pointer never fires mouseleave on the surviving tab.
  const [tooltipResetKey, setTooltipResetKey] = useState(0);
  // When the tab is read-only we hide file-mutating sections (rename/delete)
  // but keep navigation actions like "Split Right" since they don't modify
  // file content.
  const baseMenuSections = isReadOnly
    ? tabMenuSections.filter((section) =>
        section.items.every(
          (item) =>
            item.id !== TabMenuItemIds.RenameFile &&
            item.id !== TabMenuItemIds.DeleteFile,
        ),
      )
    : tabMenuSections;
  const menuSections = hideSplitRight
    ? baseMenuSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => item.id !== TabMenuItemIds.SplitRight,
          ),
        }))
        .filter((section) => section.items.length > 0)
    : baseMenuSections;
  const menuSectionsFinal = hideSplitLeft
    ? menuSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => item.id !== TabMenuItemIds.SplitLeft,
          ),
        }))
        .filter((section) => section.items.length > 0)
    : menuSections;
  const disabledKeys = [
    ...(tabsCount !== undefined && tabsCount <= 1
      ? [TabMenuItemIds.CloseOthers]
      : []),
    ...(tabIndex === 0 ? [TabMenuItemIds.CloseToTheLeft] : []),
    ...(tabIndex === undefined ||
    tabsCount === undefined ||
    tabIndex >= tabsCount - 1
      ? [TabMenuItemIds.CloseToTheRight]
      : []),
  ];

  const onTabAction = useCallback(
    (key: Key): void => {
      setTooltipResetKey((k) => k + 1);
      tabAction &&
        tabAction(
          key as TabMenuItemIds | NewTabMenuItemIds,
          tabData?.fileId ?? '',
          tabIndex,
        );
    },
    [tabData?.fileId, tabAction, tabIndex],
  );

  const onTabSelect = useCallback((): void => {
    if (!tabData) {
      return;
    }
    selectTab && selectTab({ tab: tabData });
  }, [selectTab, tabData]);

  const onTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      onTabSelect();
    },
    [onTabSelect],
  );

  const renderTabInfo = (): JSX.Element => (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild disabled={!tabData}>
        <div
          role="tab"
          aria-selected={isSelected}
          tabIndex={tabData ? 0 : -1}
          data-file-id={tabData?.fileId}
          className={clsx(styles.tab, classes?.tab, {
            [styles['tab-selected']]: isSelected,
            [classes?.selected ?? '']: isSelected,
            [styles['tab-preview']]: isPreview,
          })}
          onClick={(event): void => {
            if (!tabData) {
              return;
            }
            selectTab &&
              selectTab({
                tab: tabData,
                event,
                openAtIndex: undefined,
                isPreview,
              });
          }}
          onDoubleClick={(event): void => {
            if (!tabData) {
              return;
            }
            selectTab &&
              selectTab({
                tab: tabData,
                event,
                openAtIndex: undefined,
                isPreview: false,
              });
          }}
          onKeyDown={onTabKeyDown}
        >
          <div
            className={clsx({
              [styles['tab-icon']]: Icon,
            })}
          >
            {Icon}
          </div>
          <div className={styles['tab-label']}>{tabData?.fileFullName}</div>

          <div
            className={clsx(styles['tab-actions'], {
              [styles['tab-unsaved']]: isUnsaved,
            })}
          >
            {isUnsaved && (
              <div className={styles['tab-unsaved-badge']}>
                <UnsavedBadge />
              </div>
            )}
            {tabData && !tabData.isFixed && (
              <IconButton
                onClick={(e): void => {
                  e.stopPropagation();
                  onTabAction(TabMenuItemIds.Close);
                }}
                label="Close"
                title="Close"
                Icon={CloseX}
                onMouseEnter={(): void => setCloseTooltipVisible(true)}
                onMouseLeave={(): void => setCloseTooltipVisible(false)}
                classes={{
                  button: styles['tab-close-button'],
                  icon: styles['tab-close-button-icon'],
                  tooltip: styles['tab-close-button-tooltip'],
                }}
              />
            )}
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles['tab-menu']}>
          {menuSectionsFinal.map((section, sectionIndex) => (
            <ContextMenu.Group key={section.name}>
              {sectionIndex > 0 && (
                <ContextMenu.Separator
                  className={styles['tab-menu-separator']}
                />
              )}
              {section.items.map((item) => {
                const label =
                  typeof item.label === 'string'
                    ? item.label
                    : formatMessage(item.label);

                return (
                  <ContextMenu.Item
                    key={item.id}
                    className={styles['tab-menu-item']}
                    disabled={disabledKeys.includes(item.id as TabMenuItemIds)}
                    onSelect={(): void => onTabAction(item.id)}
                  >
                    <XXSmall>
                      {item.labelPrefix}
                      {label}
                      {item.labelSuffix}
                    </XXSmall>
                  </ContextMenu.Item>
                );
              })}
            </ContextMenu.Group>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );

  return !dataIsLoading ? (
    <WrapperTitle
      key={tooltipResetKey}
      title={closeTooltipVisible ? undefined : tabData?.fileId}
      classNames={{ tooltip: styles['tab-close-button-tooltip'] }}
    >
      {renderTabInfo()}
    </WrapperTitle>
  ) : (
    <div
      className={clsx(
        styles['tab'],
        styles['tab-selected'],
        styles['tab-is-loading'],
      )}
    >
      <div className={styles['tab-skeleton']}>
        <Skeleton variant="rounded" count={1} />
      </div>
    </div>
  );
};

EditorTab.displayName = 'EditorTab';
export default memo(EditorTab);
