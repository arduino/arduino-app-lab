import {
  WifiConnected,
  WifiDisconnected,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { SystemResource } from '../../FooterBar.type';
import NetworkPanel from '../network-panel/NetworkPanel';
import styles from './network.module.scss';

interface NetworkProps {
  networkItem: SystemResource | undefined;
  boardIP?: string | null;
}

export const Network: React.FC<NetworkProps> = ({
  networkItem,
  boardIP,
}: NetworkProps) => {
  const [isMenuVisible, setMenuVisible] = useState(false);
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
  }

  const onChange = (): void => {
    setMenuVisible(false);
    if (networkItem?.onClick) {
      networkItem.onClick();
    }
  };

  return (
    <div
      ref={menuTriggerRef}
      role="button"
      tabIndex={0}
      className={styles['network-container']}
      onClick={clickHandlerNotifications}
      onKeyUp={clickHandlerNotifications}
    >
      <div
        className={clsx(styles['network-icon-container'], {
          [styles['active']]: isMenuVisible,
          [styles['connected']]: networkItem?.state === 'default',
        })}
      >
        {networkItem?.state === 'default' ? (
          <WifiConnected />
        ) : (
          <WifiDisconnected />
        )}
      </div>
      {isMenuVisible && (
        <NetworkPanel
          ref={menuRef}
          triggerRef={menuTriggerRef}
          ssid={networkItem?.label}
          ipAddress={boardIP}
          isConnected={networkItem?.state === 'default'}
          onChange={onChange}
        />
      )}
    </div>
  );
};
