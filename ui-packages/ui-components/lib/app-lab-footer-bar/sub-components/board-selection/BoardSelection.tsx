import {
  UsbPort,
  UsbPortDisconnected,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { useI18n } from '../../../i18n/useI18n';
import styles from './board-selection.module.scss';
import { messages } from './messages';

export interface BoardSelectionProps {
  name?: string;
  state?: 'default' | 'inactive' | 'warning';
}

const FooterBadge: React.FC<BoardSelectionProps> = ({
  name,
  state = 'inactive',
}: BoardSelectionProps) => {
  const { formatMessage } = useI18n();

  return (
    <div className={clsx(styles['container'], styles[state])}>
      {state === 'inactive' ? <UsbPortDisconnected /> : <UsbPort />}
      <span>{name ? name : formatMessage(messages.notConnected)}</span>
    </div>
  );
};

export default FooterBadge;
