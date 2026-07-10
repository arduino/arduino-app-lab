import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { Spinner, Stats } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  useI18n,
  useTooltip,
  XSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { LinuxCredentialsDialog } from '../../../dialogs';
import { BoardSection } from '../board-section';
import { Action, ActionStatus } from '../runtime-actions';
import styles from './footer-bar.module.scss';
import { FooterBarProps } from './FooterBar.type';
import { messages } from './messages';
import BellIcon from './sub-components/bell-icon/BellIcon';
import { NetworkIcon } from './sub-components/network-icon/NetworkIcon';
import NotificationPanel from './sub-components/notification-panel/NotificationPanel';

const FooterBar: React.FC<FooterBarProps> = (props: FooterBarProps) => {
  const { formatMessage } = useI18n();
  const { footerBarLogic } = props;
  const {
    systemResources,
    boardItem,
    boardIP,
    newNotifications = 0,
    resetNewNotifications,
    runtimeContext,
    currentVersion,
    notifications,
    onOpenApp,
    onOpenTerminal,
    terminalError,
    isBoard,
    boards,
    selectedBoard,
    selectBoard,
    linuxCredentialsDialog,
  } = footerBarLogic();

  const showVersion = isFFEnabled('SHOW_VERSION_IN_FOOTER');

  const {
    appsStatus: { runningApp },
    runtimeActions: { currentAction, currentActionStatus, stopAction },
  } = runtimeContext;

  const stopApp = useCallback((): void => {
    if (!runningApp) return;
    stopAction(runningApp);
  }, [runningApp, stopAction]);

  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isSystemStatsVisible, setSystemStatsVisible] = useState(false);

  // Create a ref to attach to the menu container
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLDivElement>(null);

  // This effect handles clicks outside of the menu
  useEffect(() => {
    // Only add listener if menu is visible
    if (!isMenuVisible) return;
    function handleClickOutside(event: MouseEvent): void {
      // If the click is outside the menuRef, close the menu
      if (
        menuRef.current &&
        menuTriggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !menuTriggerRef.current.contains(event.target as Node)
      ) {
        setMenuVisible(false);
      }
    }

    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    // Unbind the event listener on clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuVisible]); // Re-run effect only if isMenuVisible changes

  function clickHandlerNotifications(): void {
    setMenuVisible(!isMenuVisible);
    resetNewNotifications();
  }

  const clickHandlerSystemStats = (): void => {
    setSystemStatsVisible((prev) => !prev);
  };

  const stopDisabled =
    currentActionStatus === ActionStatus.Pending &&
    currentAction === Action.Stop;

  const { props: tooltipPropsAppName, renderTooltip: renderTooltipAppName } =
    useTooltip({
      content: runningApp?.name,
      timeout: 0,
    });

  return (
    <footer className={styles['footer-bar']}>
      <div className={styles['footer-content']}>
        {/* Left section */}
        <div className={styles['footer-section--left']}>
          {/* Board section */}
          {boardItem ? (
            <BoardSection
              boardItem={boardItem}
              isBoard={isBoard}
              boards={boards}
              selectedBoard={selectedBoard}
              selectBoard={selectBoard}
              onOpenTerminal={onOpenTerminal}
              terminalError={terminalError}
            />
          ) : null}
        </div>

        {/* Center resources section */}
        <div
          className={clsx(
            styles['footer-section--center'],
            styles['footer-badge'],
            styles['xl'],
          )}
        >
          {/* Ip section */}
          {boardIP ? (
            <div className={clsx(styles['lg'], styles['footer-badge'])}>
              {boardIP}
            </div>
          ) : null}
          {systemResources.root?.label || systemResources.user?.label ? (
            <div>
              <span>{formatMessage(messages.storage)}</span>
              <span
                className={clsx(
                  styles[systemResources.root?.state || 'default'],
                )}
              >
                {systemResources.root?.label}
              </span>
              <span> - </span>
              <span
                className={clsx(
                  styles[systemResources.user?.state || 'default'],
                )}
              >
                {systemResources.user?.label}
              </span>
            </div>
          ) : null}

          {systemResources.ram ? (
            <span
              className={clsx(styles[systemResources.ram?.state || 'default'])}
            >
              {systemResources.ram?.label}
            </span>
          ) : null}

          {systemResources.npu?.label ? (
            <span
              className={clsx(styles[systemResources.npu?.state || 'default'])}
            >
              {systemResources.npu?.label}
            </span>
          ) : null}

          {systemResources.cpu ? (
            <span
              className={clsx(styles[systemResources.cpu?.state || 'default'])}
            >
              {systemResources.cpu?.label}
            </span>
          ) : null}
        </div>

        {/*Center - System Stats Section */}
        <div
          className={clsx(styles['system-stats-container'], {
            [styles['button-active']]: isSystemStatsVisible,
          })}
        >
          <Button
            appearance={ButtonAppearance.LowContrast}
            variant={ButtonVariant.Tertiary}
            onClick={clickHandlerSystemStats}
            size={ButtonSize.XSmall}
            Icon={Stats}
            title={formatMessage(messages.systemStats)}
          >
            {formatMessage(messages.systemStats)}
          </Button>

          {isSystemStatsVisible ? (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              className={styles['system-stats-overlay']}
              onMouseDown={(
                e: React.MouseEvent<HTMLDivElement, MouseEvent>,
              ): void => e.preventDefault()}
            >
              <div className={styles['system-stats-overlay--header']}>
                <Stats /> {formatMessage(messages.systemInfo)}
              </div>
              <div
                className={clsx(
                  styles['system-stats-overlay--content'],
                  styles['footer-badge'],
                )}
              >
                {boardIP ? (
                  <div className={clsx(styles['ip'])}>{boardIP}</div>
                ) : null}

                {systemResources.root?.label ? (
                  <div>
                    <span>{formatMessage(messages.storage)}</span>
                    <span
                      className={clsx(
                        styles[systemResources.root?.state || 'default'],
                      )}
                    >
                      {systemResources.root?.label}
                    </span>
                  </div>
                ) : null}

                {systemResources.user?.label ? (
                  <span
                    className={clsx(
                      styles[systemResources.user?.state || 'default'],
                    )}
                  >
                    {systemResources.user?.label}
                  </span>
                ) : null}

                {systemResources.ram ? (
                  <span
                    className={clsx(
                      styles[systemResources.ram?.state || 'default'],
                    )}
                  >
                    {systemResources.ram?.label}
                  </span>
                ) : null}

                {systemResources.npu?.label ? (
                  <span
                    className={clsx(
                      styles[systemResources.npu?.state || 'default'],
                    )}
                  >
                    {systemResources.npu?.label}
                  </span>
                ) : null}

                {systemResources.cpu ? (
                  <span
                    className={clsx(
                      styles[systemResources.cpu?.state || 'default'],
                    )}
                  >
                    {systemResources.cpu?.label}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right section */}
        <div className={styles['footer-section--right']}>
          {runningApp ? (
            <div className={styles['footer-section']}>
              <div
                role="button"
                tabIndex={0}
                className={styles['app-name-container']}
                {...tooltipPropsAppName}
                onKeyUp={(): void => onOpenApp(runningApp)}
                onClick={(): void => onOpenApp(runningApp)}
              >
                <span>{runningApp.icon}</span>
                <XSmall className={styles['app-name']}>
                  {runningApp.name}
                </XSmall>
                {renderTooltipAppName(styles['app-name-tooltip-content'])}
              </div>
              {currentActionStatus === ActionStatus.Pending && (
                <div className={styles['app-name-loader']}>
                  <Spinner />
                </div>
              )}
              <Button
                onClick={stopApp}
                variant={ButtonVariant.Secondary}
                size={ButtonSize.XSmall}
                appearance={ButtonAppearance.Destructive}
                disabled={stopDisabled}
              >
                Stop
              </Button>
            </div>
          ) : null}

          {showVersion ? (
            <div className={clsx(styles['footer-section'], styles['version'])}>
              {formatMessage(messages.version, {
                version: currentVersion,
              })}
            </div>
          ) : null}

          <div
            ref={menuTriggerRef}
            role="button"
            tabIndex={0}
            className={styles['notifications-container']}
            onClick={clickHandlerNotifications}
            onKeyUp={clickHandlerNotifications}
          >
            <BellIcon
              active={isMenuVisible}
              newNotifications={newNotifications}
            />
            {isMenuVisible && (
              <NotificationPanel ref={menuRef} items={notifications || []} />
            )}
          </div>

          <NetworkIcon networkItem={systemResources.network} />
        </div>
      </div>

      <LinuxCredentialsDialog logic={linuxCredentialsDialog} />
    </footer>
  );
};

export default FooterBar;
