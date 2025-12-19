import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { MessageDescriptor } from 'react-intl';

import { useI18n } from '../../i18n/useI18n';
import { XXXSmall } from '../../typography';
import { SidePanelItemId } from '../sidePanel.type';
import styles from './side-panel-item.module.scss';

interface SidePanelItemProps {
  id: SidePanelItemId;
  label: MessageDescriptor;
  Icon?: React.FC | string;
  isActive?: boolean;
  externalLink?: string;
  children?: React.ReactNode;
}

const SidePanelItem: React.FC<SidePanelItemProps> = (
  props: SidePanelItemProps,
) => {
  const { id, label, Icon, isActive, externalLink, children } = props;

  const { formatMessage } = useI18n();

  return (
    <li
      id={id}
      title={formatMessage(label)}
      className={clsx(styles['side-panel-item'], {
        [styles['active']]: isActive,
      })}
    >
      {children ? (
        children
      ) : (
        <Link
          to={externalLink ? externalLink : `/${id}`}
          target={externalLink ? '_blank' : undefined}
          rel="noreferrer"
          className={styles['link']}
        >
          <div className={styles['icon']}>
            {typeof Icon === 'string' ? (
              <img src={Icon} alt="Icon" />
            ) : (
              Icon && <Icon />
            )}
          </div>
          <XXXSmall>{formatMessage(label)}</XXXSmall>
        </Link>
      )}
    </li>
  );
};
export default SidePanelItem;
