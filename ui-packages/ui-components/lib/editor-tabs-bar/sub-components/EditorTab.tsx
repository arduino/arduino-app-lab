import { CloseX, UnsavedBadge } from '@cloud-editor-mono/images/assets/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import {
  forwardRef,
  Key,
  memo,
  ReactElement,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useFocusRing, useMenuTrigger } from 'react-aria';
import {
  Item,
  MenuTriggerState,
  Section,
  useMenuTriggerState,
} from 'react-stately';

import { DropdownMenuPopover } from '../../essential/dropdown-menu';
import DropdownMenu from '../../essential/dropdown-menu/DropdownMenu';
import { IconButton } from '../../essential/icon-button';
import { WrapperTitle } from '../../essential/wrapper-title';
import { useI18n } from '../../i18n/useI18n';
import { Skeleton } from '../../skeleton';
import { XSmall, XXSmall } from '../../typography';
import {
  NewTabMenuItemIds,
  SelectableFileData,
  TabMenuItemIds,
  TabMenuItemType,
} from '../EditorTabsBar.type';
import styles from './editor-tab.module.scss';
import { tabMenuSections } from './editorTabMenuSpec';

interface EditorTabProps {
  id?: string;
  tabData?: SelectableFileData;
  Icon?: React.FC;
  isSelected: boolean;
  selectTab?: (
    tab: SelectableFileData,
    event?: React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined,
  ) => void;
  dataIsLoading?: boolean;
  isMainFile?: boolean;
  tabAction?: (key: NewTabMenuItemIds, fileId: string) => void;
  isUnsaved?: boolean;
  deleteFile?: () => void;
  isReadOnly: boolean;
  setOpenMenuMap?: React.Dispatch<
    React.SetStateAction<Map<string, MenuTriggerState>>
  >;
  classes?: { selected?: string; tab?: string };
}

const EditorTab = forwardRef(
  (
    props: EditorTabProps,
    ref: React.ForwardedRef<HTMLLIElement>,
  ): React.ReactElement => {
    const {
      tabData,
      Icon,
      isSelected,
      selectTab,
      dataIsLoading,
      isUnsaved,
      tabAction,
      isReadOnly,
      setOpenMenuMap,
      classes,
    } = props;

    const { formatMessage } = useI18n();

    const { isFocusVisible, focusProps } = useFocusRing();
    const [isTabHovered, setIsTabHovered] = useState(false);

    const state = useMenuTriggerState({});
    const buttonRef = useRef<HTMLButtonElement>(null);

    const { menuProps } = useMenuTrigger<TabMenuItemType>({}, state, buttonRef);

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: props.id ?? '' });
    const localRef = useRef<HTMLLIElement | null>(null);

    useImperativeHandle(ref, () => localRef.current as HTMLLIElement);

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 1 : 'auto',
    };

    const onTabAction = useCallback(
      (key: Key): void =>
        tabAction && tabAction(key as NewTabMenuItemIds, tabData?.fileId ?? ''),
      [tabData?.fileId, tabAction],
    );

    const renderTabInfo = (): JSX.Element => (
      <li
        ref={(ref): void => {
          setNodeRef(ref);
          localRef.current = ref;
        }}
        className={clsx(styles.tab, classes?.tab, {
          [styles['tab-selected']]: isSelected,
          [classes?.selected ?? '']: isSelected,
          [styles['tab-focused']]: isFocusVisible,
        })}
        onMouseEnter={(): void => setIsTabHovered(true)}
        onMouseLeave={(): void => setIsTabHovered(false)}
        {...attributes}
        {...listeners}
        style={style}
      >
        <button
          {...focusProps}
          ref={buttonRef}
          onClick={(e): void => {
            if (!tabData) {
              return;
            }
            selectTab && selectTab(tabData, e);
          }}
          className={styles['tab-button']}
          onContextMenu={(e): void => {
            if (isReadOnly) {
              return;
            }

            e.preventDefault();
            state.open();

            if (tabData && setOpenMenuMap) {
              setOpenMenuMap((prev) => {
                const newMap = new Map(prev);
                newMap.forEach((state, key) => {
                  if (key !== tabData.fileId) {
                    state.close();
                  }
                });
                newMap.set(tabData.fileId, state);
                return newMap;
              });
            }
          }}
        >
          <div
            className={clsx({
              [styles['tab-icon']]: Icon,
            })}
          >
            {Icon ? <Icon /> : null}
          </div>
          <WrapperTitle title={isDragging ? undefined : tabData?.fileFullName}>
            <XSmall className={styles['tab-label']}>
              {tabData?.fileFullName}
            </XSmall>
          </WrapperTitle>
        </button>

        {state.isOpen && (
          <DropdownMenuPopover
            triggerRef={buttonRef}
            state={state}
            classes={{
              dropdownMenuPopover: styles['tab-menu-popover'],
            }}
          >
            <DropdownMenu
              {...menuProps}
              onAction={onTabAction}
              classes={{
                dropdownMenu: styles['tab-menu'],
              }}
              useStaticPosition={true}
            >
              {tabMenuSections.map((section) => (
                <Section key={section.name} items={section.items}>
                  {(item): ReactElement => {
                    const label =
                      typeof item.label === 'string'
                        ? item.label
                        : formatMessage(item.label);

                    return (
                      <Item textValue={label}>
                        <XXSmall>
                          {item.labelPrefix}
                          {label}
                          {item.labelSuffix}
                        </XXSmall>
                      </Item>
                    );
                  }}
                </Section>
              ))}
            </DropdownMenu>
          </DropdownMenuPopover>
        )}

        <div
          className={clsx(styles['tab-close-button-wrapper'], {
            [styles['tab-close-button-wrapper-selected']]: isSelected,
            [styles['tab-close-button-wrapper-visible']]:
              isTabHovered || isUnsaved,
          })}
        >
          {isUnsaved && (!isTabHovered || isReadOnly) ? (
            <div className={styles['tab-unsaved-badge']}>
              <UnsavedBadge />
            </div>
          ) : tabData && !tabData.isFixed ? (
            <IconButton
              onPress={(): void => onTabAction(TabMenuItemIds.Close)}
              label="Close"
              Icon={CloseX}
              classes={{
                button: clsx(styles['tab-close-button'], {
                  [styles['tab-close-button-visible']]:
                    isTabHovered || isSelected,
                }),
                icon: styles['tab-close-button-icon'],
              }}
            />
          ) : null}
        </div>
      </li>
    );

    return !dataIsLoading ? (
      renderTabInfo()
    ) : (
      <li className={styles['tab-skeleton-wrapper']}>
        <div className={styles['tab-skeleton']}>
          <Skeleton variant="rounded" count={1} />
        </div>
      </li>
    );
  },
);

EditorTab.displayName = 'EditorTab';
export default memo(EditorTab);
