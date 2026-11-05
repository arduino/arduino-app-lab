import {
  AppRelease,
  Bin,
  Download,
  Duplicate,
  InfoIconOutline,
  Pencil,
  Power,
  ThreeDots,
} from '@cloud-editor-mono/images/assets/icons';
import { canRenameApp } from '@cloud-editor-mono/infrastructure';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import React from 'react';

import { DropdownMenuButton } from '../../../essential/dropdown-menu/DropdownMenuButton';
import { useI18n } from '../../../i18n/useI18n';
import { Skeleton } from '../../../skeleton';
import { XXSmall } from '../../../typography';
import { getBackgroundIcon } from '../../../utils';
import {
  appReleaseMessages,
  CreateReleaseDisabledItem,
  ReleaseBadge,
} from '../app-release';
import { AppAction } from '../app-title';
import { EmojiPreview } from '../emoji-picker/sub-components/EmojiPreview';
import { Toggle } from '../essential/toggle';
import styles from './app-item.module.scss';
import { AppItemProps } from './AppItem.type';
import { appItemMessages } from './messages';

const DEFAULT_ICON = '⚪'; // Default icon if none is provided

const AppItem: React.FC<AppItemProps> = (props: AppItemProps) => {
  const {
    icon,
    name,
    description,
    defaultApp,
    status,
    example,
    variant = 'default',
    onRename,
    onDuplicate,
    onExport,
    onCreateRelease,
    createReleaseDisabledReason,
    onReleaseInfo,
    releaseBadge,
    onSetAsDefault,
    onDelete,
    onMenuOpen,
    isAnimating,
  } = props;

  const { formatMessage } = useI18n();

  const hasActions =
    onRename ||
    onDuplicate ||
    onExport ||
    onCreateRelease ||
    onReleaseInfo ||
    onSetAsDefault ||
    onDelete;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMenuOpen = React.useCallback(
    (isOpen: boolean) => {
      setMenuOpen(isOpen);
      onMenuOpen?.(isOpen);
    },
    [onMenuOpen],
  );

  const isDefault = defaultApp?.id === props.id;

  const canRenameAppTitle = canRenameApp(
    props.id && name && status
      ? {
          id: props.id,
          name,
          icon,
          description,
          status,
          example,
          default: isDefault,
        }
      : undefined,
    status,
  );

  const handleAction = (action: AppAction | string): void => {
    switch (action) {
      case AppAction.Rename:
        onRename?.();
        break;
      case AppAction.Duplicate:
        onDuplicate?.();
        break;
      case AppAction.Export:
        onExport?.();
        break;
      case AppAction.CreateRelease:
        onCreateRelease?.();
        break;
      case AppAction.ReleaseInfo:
        onReleaseInfo?.();
        break;
      case AppAction.Delete:
        onDelete?.();
        break;
      case 'default':
        onSetAsDefault?.();
        break;
    }
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        className={styles['context-menu-trigger']}
        disabled={!hasActions && !isAnimating}
      >
        <div
          className={styles['container']}
          onMouseEnter={(): void => setIsHovered(true)}
          onMouseLeave={(): void => setIsHovered(false)}
        >
          {/* Header */}
          <div className={styles['header']}>
            <div
              className={styles['header-bg']}
              style={{
                backgroundImage: getBackgroundIcon(icon || DEFAULT_ICON),
              }}
            ></div>

            {isDefault && (
              <span className={styles['header-default']}>
                {formatMessage(appItemMessages.appDefault)}
              </span>
            )}

            <span
              className={clsx({
                [styles['header-icon-skeleton']]:
                  variant === 'skeleton' || !icon,
                [styles['header-icon']]: variant === 'default',
              })}
            >
              <EmojiPreview size={32} value={icon || DEFAULT_ICON} />
            </span>
          </div>

          {/* Content */}
          {variant === 'default' && (
            <div className={styles['content']}>
              <div
                className={clsx(styles['content-title'], {
                  [styles['with-actions']]: hasActions,
                  [styles['menu-open']]: menuOpen,
                })}
              >
                <div className={styles['title']}>{name}</div>
                {status === 'running' && (
                  <div className={styles['running']}>
                    {formatMessage(appItemMessages.appRunning)}
                  </div>
                )}
                {hasActions && isHovered && !isAnimating && (
                  <div
                    role="presentation"
                    onClick={(e): void => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e): void => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <DropdownMenuButton
                      sections={[
                        {
                          name: 'Actions',
                          items: [
                            ...(onReleaseInfo
                              ? [
                                  {
                                    id: AppAction.ReleaseInfo,
                                    label: formatMessage(
                                      appReleaseMessages.actionReleaseInfo,
                                    ),
                                    labelPrefix: (
                                      <span
                                        className={styles['context-menu-icon']}
                                      >
                                        <InfoIconOutline />
                                      </span>
                                    ),
                                  },
                                ]
                              : []),
                            ...(onRename && canRenameAppTitle
                              ? [
                                  {
                                    id: AppAction.Rename,
                                    label: formatMessage(
                                      appItemMessages.actionRename,
                                    ),
                                    labelPrefix: (
                                      <span
                                        className={styles['context-menu-icon']}
                                      >
                                        <Pencil />
                                      </span>
                                    ),
                                  },
                                ]
                              : []),
                            ...(onDuplicate
                              ? [
                                  {
                                    id: AppAction.Duplicate,
                                    label: formatMessage(
                                      appItemMessages.actionDuplicate,
                                    ),
                                    labelPrefix: (
                                      <span
                                        className={styles['context-menu-icon']}
                                      >
                                        <Duplicate />
                                      </span>
                                    ),
                                  },
                                ]
                              : []),
                            ...(onCreateRelease
                              ? [
                                  {
                                    id: AppAction.CreateRelease,
                                    label: formatMessage(
                                      appReleaseMessages.actionCreateRelease,
                                    ),
                                    ...(createReleaseDisabledReason
                                      ? {
                                          node: (
                                            <CreateReleaseDisabledItem
                                              reason={
                                                createReleaseDisabledReason
                                              }
                                            />
                                          ),
                                        }
                                      : {
                                          labelPrefix: (
                                            <span
                                              className={
                                                styles['context-menu-icon']
                                              }
                                            >
                                              <AppRelease />
                                            </span>
                                          ),
                                        }),
                                  },
                                ]
                              : []),
                            ...(onExport
                              ? [
                                  {
                                    id: AppAction.Export,
                                    label: formatMessage(
                                      appItemMessages.actionExport,
                                    ),
                                    labelPrefix: (
                                      <span
                                        className={styles['context-menu-icon']}
                                      >
                                        <Download />
                                      </span>
                                    ),
                                  },
                                ]
                              : []),
                          ],
                        },
                        ...(onSetAsDefault
                          ? [
                              {
                                name: 'Default app',
                                items: [
                                  {
                                    id: 'default',
                                    label: formatMessage(
                                      appItemMessages.actionRunAsStartup,
                                    ),
                                    node: (
                                      <div
                                        className={
                                          styles['default-app-menu-item']
                                        }
                                      >
                                        <div
                                          className={
                                            styles[
                                              'default-app-menu-item-divider'
                                            ]
                                          }
                                        />
                                        <div
                                          className={
                                            styles[
                                              'default-app-menu-item-title'
                                            ]
                                          }
                                        >
                                          <span
                                            className={
                                              styles['context-menu-icon']
                                            }
                                          >
                                            <Power />
                                          </span>
                                          <XXSmall>
                                            {formatMessage(
                                              appItemMessages.actionRunAsStartup,
                                            )}
                                          </XXSmall>
                                          <Toggle
                                            elementType="span"
                                            className={
                                              styles['default-app-toggle']
                                            }
                                            isSelected={isDefault}
                                          />
                                        </div>
                                      </div>
                                    ),
                                  },
                                ],
                              },
                            ]
                          : []),
                        ...(onDelete && !example
                          ? [
                              {
                                name: 'Delete',
                                items: [
                                  {
                                    id: AppAction.Delete,
                                    itemClassName: styles['danger'],
                                    label: formatMessage(
                                      appItemMessages.actionDelete,
                                    ),
                                    labelPrefix: (
                                      <span
                                        className={styles['context-menu-icon']}
                                      >
                                        <Bin />
                                      </span>
                                    ),
                                  },
                                ],
                              },
                            ]
                          : []),
                      ]}
                      classes={{
                        dropdownMenu: styles['dropdownMenu'],
                        dropdownMenuButton: styles['dropdownMenuButton'],
                        dropdownMenuButtonOpen:
                          styles['dropdownMenuButtonOpen'],
                        dropdownMenuButtonWrapper:
                          styles['dropdownMenuButtonWrapper'],
                        dropdownMenuItem: styles['dropdownMenuItem'],
                        dropdownMenuList: styles['dropdownMenuList'],
                      }}
                      disabledKeys={
                        createReleaseDisabledReason
                          ? [AppAction.CreateRelease]
                          : undefined
                      }
                      onAction={(key): void => handleAction(key as AppAction)}
                      onOpen={handleMenuOpen}
                      buttonChildren={<ThreeDots width={14} height={14} />}
                      // react-aria computes the position against the viewport, which
                      // only matches where the popover is placed when it is portaled.
                      useStaticPosition={false}
                      usePortal
                    />
                  </div>
                )}
              </div>
              <div className={styles['content-description']}>{description}</div>
              {releaseBadge ? (
                <div className={styles['release']}>
                  <ReleaseBadge label={releaseBadge.label} />
                  {releaseBadge.createdAt ? (
                    <span className={styles['release-date']}>
                      {releaseBadge.createdAt}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {variant === 'skeleton' && (
            <div className={styles['content']}>
              <div className={styles['content-title-skeleton']}>
                <Skeleton variant="rounded" count={1} />
              </div>
              <div className={styles['content-description-skeleton']}>
                <Skeleton variant="rounded" count={3} />
              </div>
            </div>
          )}
        </div>
      </ContextMenu.Trigger>

      {hasActions && (
        <ContextMenu.Portal>
          <ContextMenu.Content
            className={styles['context-menu-content']}
            onClick={(e): void => e.stopPropagation()}
          >
            {onReleaseInfo && (
              <ContextMenu.Item
                className={styles['context-menu-item']}
                onSelect={(): void => onReleaseInfo()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                <span className={styles['context-menu-icon']}>
                  <InfoIconOutline />
                </span>
                <XXSmall>
                  {formatMessage(appReleaseMessages.actionReleaseInfo)}
                </XXSmall>
              </ContextMenu.Item>
            )}
            {onRename && canRenameAppTitle && (
              <ContextMenu.Item
                className={styles['context-menu-item']}
                onSelect={(): void => onRename()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                <span className={styles['context-menu-icon']}>
                  <Pencil />
                </span>
                <XXSmall>{formatMessage(appItemMessages.actionRename)}</XXSmall>
              </ContextMenu.Item>
            )}
            {onDuplicate && (
              <ContextMenu.Item
                className={styles['context-menu-item']}
                onSelect={(): void => onDuplicate()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                <span className={styles['context-menu-icon']}>
                  <Duplicate />
                </span>
                <XXSmall>
                  {formatMessage(appItemMessages.actionDuplicate)}
                </XXSmall>
              </ContextMenu.Item>
            )}
            {onCreateRelease && (
              <ContextMenu.Item
                className={clsx(
                  styles['context-menu-item'],
                  createReleaseDisabledReason &&
                    styles['context-menu-item-disabled'],
                )}
                disabled={Boolean(createReleaseDisabledReason)}
                onSelect={(): void => onCreateRelease()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                {createReleaseDisabledReason ? (
                  <CreateReleaseDisabledItem
                    reason={createReleaseDisabledReason}
                  />
                ) : (
                  <>
                    <span className={styles['context-menu-icon']}>
                      <AppRelease />
                    </span>
                    <XXSmall>
                      {formatMessage(appReleaseMessages.actionCreateRelease)}
                    </XXSmall>
                  </>
                )}
              </ContextMenu.Item>
            )}
            {onExport && (
              <ContextMenu.Item
                className={styles['context-menu-item']}
                onSelect={(): void => onExport()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                <span className={styles['context-menu-icon']}>
                  <Download />
                </span>
                <XXSmall>{formatMessage(appItemMessages.actionExport)}</XXSmall>
              </ContextMenu.Item>
            )}
            {onSetAsDefault && (
              <ContextMenu.Item
                className={clsx(styles['context-menu-item'], styles['divider'])}
                onSelect={(): void => onSetAsDefault()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                <span className={styles['context-menu-icon']}>
                  <Power />
                </span>
                <XXSmall>
                  {formatMessage(appItemMessages.actionRunAsStartup)}
                </XXSmall>
                <Toggle
                  className={styles['default-app-toggle']}
                  isSelected={isDefault}
                />
              </ContextMenu.Item>
            )}
            {onDelete && !example && (
              <ContextMenu.Item
                className={clsx(styles['context-menu-item'], styles['danger'])}
                onSelect={(): void => onDelete()}
                onPointerDown={(e): void => e.stopPropagation()}
              >
                <span className={styles['context-menu-icon']}>
                  <Bin />
                </span>
                <XXSmall>{formatMessage(appItemMessages.actionDelete)}</XXSmall>
              </ContextMenu.Item>
            )}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
};

export default AppItem;
