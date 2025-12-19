import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AppLabAppTitle } from '../app-lab-app-title';
import { AppLabActionStatus, RuntimeActions } from '../app-lab-runtime-actions';
import type { AppLabFooterBarProps, FooterItem } from './AppLabFooterBar.type';
import styles from './footer-bar.module.scss';
import BellIcon from './sub-components/bell-icon/BellIcon';
import BoardSection from './sub-components/board-section/BoardSection';
import { NetworkIcon } from './sub-components/network-icon/NetworkIcon';
import NotificationPanel from './sub-components/notification-panel/NotificationPanel';

const AppLabFooterBar: React.FC<AppLabFooterBarProps> = (
  props: AppLabFooterBarProps,
) => {
  const { footerBarLogic } = props;
  const {
    items,
    newNotifications = 0,
    resetNewNotifications,
    runtimeContext,
    currentVersion,
    useCreateAppTitleLogic,
    notifications,
    onOpenTerminal,
    terminalError,
    isBoard,
  } = footerBarLogic();

  const showVersion = isFFEnabled('SHOW_VERSION_IN_FOOTER');

  const {
    defaultApp,
    runningApp,
    activeApp,
    currentAction,
    currentActionStatus,
    runAction,
    stopAction,
  } = runtimeContext;

  const footerApp = runningApp || activeApp || defaultApp;

  const runApp = useCallback((): void => {
    if (!footerApp) return;
    runAction(footerApp);
  }, [footerApp, runAction]);

  const stopApp = useCallback((): void => {
    if (!footerApp) return;
    stopAction(footerApp);
  }, [footerApp, stopAction]);

  const [isMenuVisible, setMenuVisible] = useState(false);
  // Create a ref to attach to the menu container
  const menuRef = useRef<HTMLDivElement>(null);

  // This effect handles clicks outside of the menu
  useEffect(() => {
    // Only add listener if menu is visible
    if (!isMenuVisible) return;
    function handleClickOutside(event: MouseEvent): void {
      // If the click is outside the menuRef, close the menu
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  function clickHandler(): void {
    setMenuVisible(!isMenuVisible);
    resetNewNotifications();
  }

  const appTitleLogic = useCreateAppTitleLogic(footerApp);

  const runtimeActionsLogic = useCallback(
    () => ({
      appId: footerApp?.id || '',
      appName: footerApp?.name || '',
      appStatus: footerApp?.status || 'stopped',
      currentAction,
      currentActionStatus,
      runApp,
      stopApp,
      isBannerEnabled: false,
      showStop: true,
    }),
    [currentAction, currentActionStatus, footerApp, runApp, stopApp],
  );

  const getItemById = (id: string): FooterItem | undefined => {
    return items.find((item) => item.id === id);
  };

  const boardItem = getItemById('board');
  const userItem = getItemById('user');
  const rootItem = getItemById('root');
  const ramItem = getItemById('ram');
  const cpuItem = getItemById('cpu');
  const networkItem = getItemById('network');
  const ipItem = getItemById('ip');

  return (
    <footer className={styles['footer-bar']}>
      <div className={styles['footer-content']}>
        {/* Board section */}
        {boardItem && (
          <div className={styles['left-buttons-container']}>
            <BoardSection
              boardItem={boardItem}
              isBoard={isBoard}
              onOpenTerminal={onOpenTerminal}
              terminalError={terminalError}
            />
          </div>
        )}
        {/* Ip section */}
        {ipItem?.label && (
          <div className={clsx(styles['xl'], styles['footer-badge'])}>
            {ipItem?.label}
          </div>
        )}

        {/* System section */}
        <div className={clsx(styles['system-info'], styles['footer-badge'])}>
          {(rootItem?.label || userItem?.label) && (
            <div className={styles['lg']}>
              <span>STORAGE: </span>
              <span className={clsx(styles[rootItem?.state || 'default'])}>
                {rootItem?.label}
              </span>
              <span> - </span>
              <span className={clsx(styles[userItem?.state || 'default'])}>
                {userItem?.label}
              </span>
            </div>
          )}
          {ramItem && (
            <span
              className={clsx(
                styles[ramItem?.state || 'default'],
                styles['md'],
              )}
            >
              {ramItem?.label}
            </span>
          )}
          {cpuItem && (
            <span
              className={clsx(
                styles[cpuItem?.state || 'default'],
                styles['md'],
              )}
            >
              {cpuItem?.label}
            </span>
          )}
        </div>

        {/* Right section */}
        <div className={styles['footer-section--right']}>
          {footerApp && (
            <div className={styles['footer-section']}>
              <AppLabAppTitle
                key="app-title"
                appTitleLogic={appTitleLogic}
                showBadge={false}
                useStaticPosition={false}
                loader={currentActionStatus === AppLabActionStatus.Pending}
                //disabled={currentActionStatus === ActionStatus.Pending}
                //TODO: Enable the dynamic disable when the dropdown menu is correct
                disabled={true}
                type={'footer'}
              />
              <RuntimeActions
                runtimeActionsLogic={runtimeActionsLogic}
                size={'small'}
              />
            </div>
          )}
          {showVersion && (
            <div className={clsx(styles['footer-section'], styles['version'])}>
              v. {currentVersion}
            </div>
          )}
          <div
            role="button"
            tabIndex={0}
            className={styles['notifications-container']}
            onClick={clickHandler}
            onKeyUp={clickHandler}
          >
            <BellIcon
              active={isMenuVisible}
              newNotifications={newNotifications}
            />
            {isMenuVisible && (
              <NotificationPanel
                items={notifications || []}
                onClose={clickHandler}
              />
            )}
          </div>
          <NetworkIcon networkItem={networkItem} />
        </div>
      </div>
    </footer>
  );
};

export default AppLabFooterBar;
