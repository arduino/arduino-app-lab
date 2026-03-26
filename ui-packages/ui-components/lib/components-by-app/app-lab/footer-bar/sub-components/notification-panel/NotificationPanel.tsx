import {
  Notification,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { forwardRef } from 'react';

import styles from './notification-panel.module.scss';

interface NotificationPanelProps {
  items: Notification[];
}
const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(
  ({ items }, ref) => (
    <div
      role="menu"
      tabIndex={0}
      ref={ref}
      className={styles['notification-menu']}
      onClick={(e): void => e.stopPropagation()}
      onKeyUp={(e): void => e.stopPropagation()}
    >
      <XXSmall className={styles['notification-menu-header']}>
        Notifications
      </XXSmall>
      <div className={styles['notification-menu-content']}>
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              role={item.onClick ? 'button' : undefined}
              title={item.tooltip}
              key={index}
              className={clsx(styles['notification-item'], {
                [styles['is-clickable']]: !!item.onClick,
              })}
              onClick={item.onClick}
              onKeyUp={item.onClick}
            >
              {item.icon && (
                <span
                  title={item.tooltip}
                  className={styles['notification-icon']}
                >
                  {item.icon}
                </span>
              )}
              <XXSmall className={styles['notification-text']}>
                {item.label}
              </XXSmall>
            </div>
          ))
        ) : (
          <XXSmall className={clsx(styles['no-notifications'])}>
            No new notifications
          </XXSmall>
        )}
      </div>
    </div>
  ),
);
NotificationPanel.displayName = 'NotificationPanel';

export default NotificationPanel;
