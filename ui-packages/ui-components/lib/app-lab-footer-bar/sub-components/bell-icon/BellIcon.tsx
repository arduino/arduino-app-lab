import { Bell, BellWithDot } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import styles from './bell-icon.module.scss';

interface BellIconProps {
  active: boolean;
  newNotifications: number;
}

const BellIcon: React.FC<BellIconProps> = ({
  active,
  newNotifications,
}: BellIconProps) => (
  <div
    className={clsx(styles['bell-icon-container'], {
      [styles['active']]: active,
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
);

export default BellIcon;
