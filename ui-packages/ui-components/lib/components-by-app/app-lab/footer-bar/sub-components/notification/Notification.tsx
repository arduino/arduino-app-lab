import { Bell, BellWithDot } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  useI18n,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { Notification as NotificationItem } from '../../FooterBar.type';
import { messages } from '../../messages';
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
  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.notifications),
  });

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
    <>
      <div {...tooltipProps}>
        <Button
          ref={menuTriggerRef as unknown as React.RefObject<HTMLButtonElement>}
          variant={ButtonVariant.Tertiary}
          appearance={ButtonAppearance.LowContrast}
          size={ButtonSize.XSmall}
          onClick={clickHandlerNotifications}
          classes={{
            button: clsx(styles['notification-button'], {
              [styles['active']]: isMenuVisible,
            }),
          }}
        >
          <div className={styles['notification-icon-container']}>
            {newNotifications === 0 ? <Bell /> : <BellWithDot />}
            {newNotifications > 0 && (
              <span className={clsx(styles['notification-label'])}>
                {newNotifications}
              </span>
            )}
          </div>
        </Button>
        {renderTooltip()}
      </div>
      {isMenuVisible && (
        <NotificationPanel
          ref={menuRef}
          triggerRef={menuTriggerRef}
          items={notifications || []}
        />
      )}
    </>
  );
};
