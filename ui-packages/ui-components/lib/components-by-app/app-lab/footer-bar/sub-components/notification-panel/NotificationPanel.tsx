import {
  Notification,
  useI18n,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { forwardRef } from 'react';

import { messages } from '../../messages';
import Panel from '../panel/Panel';
import styles from './notification-panel.module.scss';

interface NotificationPanelProps {
  items: Notification[];
  triggerRef?: React.RefObject<HTMLElement>;
}
const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(
  ({ items, triggerRef }, ref) => {
    const { formatMessage } = useI18n();

    return (
      <Panel
        ref={ref}
        triggerRef={triggerRef}
        title={formatMessage(messages.notificationPanelTitle)}
      >
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
              {formatMessage(messages.notificationPanelNoNotifications)}
            </XXSmall>
          )}
        </div>
      </Panel>
    );
  },
);
NotificationPanel.displayName = 'NotificationPanel';

export default NotificationPanel;
