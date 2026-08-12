import { Bell, BellWithDot } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { Notification as NotificationItem } from '../../FooterBar.type';
import NotificationPanel from '../notification-panel/NotificationPanel';
import styles from './notification.module.scss';

interface NotificationProps {
  notifications: NotificationItem[];
  newNotifications: number;
  resetNewNotifications: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
  notifications,
  newNotifications,
  resetNewNotifications,
}: NotificationProps) => {
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
    resetNewNotifications();
  }

  return (
    <div
      ref={menuTriggerRef}
      role="button"
      tabIndex={0}
      className={styles['notification-container']}
      onClick={clickHandlerNotifications}
      onKeyUp={clickHandlerNotifications}
    >
      <div
        className={clsx(styles['notification-icon-container'], {
          [styles['active']]: isMenuVisible,
          [styles['empty']]: newNotifications === 0,
        })}
      >
        {newNotifications === 0 ? <Bell /> : <BellWithDot />}
        {newNotifications > 0 && (
          <span className={clsx(styles['notification-label'])}>
            {newNotifications}
          </span>
        )}
      </div>
      {isMenuVisible && (
        <NotificationPanel
          ref={menuRef}
          triggerRef={menuTriggerRef}
          items={notifications || []}
        />
      )}
    </div>
  );
};
