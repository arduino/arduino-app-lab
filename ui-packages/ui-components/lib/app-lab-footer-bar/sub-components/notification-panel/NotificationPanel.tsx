import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { IconButton } from '../../../essential/icon-button';
import { XXSmall } from '../../../typography';
import type { Notification } from '../../AppLabFooterBar.type';
import styles from './notification-panel.module.scss';

interface NotificationPanelProps {
  items: Notification[];
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  items,
  onClose,
}: NotificationPanelProps) => {
  return (
    <div className={clsx(styles['notification-menu'])}>
      <div className={clsx(styles['notification-menu-header'])}>
        <XXSmall>Notifications</XXSmall>
        <IconButton
          label="Close"
          Icon={ChevronDown}
          classes={{
            button: styles['notification-menu-header-button'],
          }}
          onPress={onClose}
        />
      </div>
      <div className={clsx(styles['notification-menu-content'])}>
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
                  className={clsx(styles['notification-icon'])}
                >
                  {item.icon}
                </span>
              )}
              {item.label}
            </div>
          ))
        ) : (
          <div className={clsx(styles['no-notifications'])}>
            No new notifications
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
