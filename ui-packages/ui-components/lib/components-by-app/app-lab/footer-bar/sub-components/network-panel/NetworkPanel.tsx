import { Wifi } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonVariant,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { forwardRef } from 'react';

import { messages } from '../../messages';
import Panel from '../panel/Panel';
import styles from './network-panel.module.scss';

interface NetworkPanelProps {
  ssid?: string;
  ipAddress?: string | null;
  isConnected?: boolean;
  triggerRef?: React.RefObject<HTMLElement>;
  onChange?: () => void;
}
const NetworkPanel = forwardRef<HTMLDivElement, NetworkPanelProps>(
  ({ ssid, ipAddress, isConnected, triggerRef, onChange }, ref) => {
    const { formatMessage } = useI18n();

    return (
      <Panel
        ref={ref}
        triggerRef={triggerRef}
        title={formatMessage(messages.networkPanelTitle)}
        action={
          <Button
            variant={ButtonVariant.Secondary}
            onClick={onChange}
            classes={{
              button: styles['network-button'],
              textButtonText: styles['network-button-text'],
            }}
          >
            {formatMessage(messages.networkPanelChangeButton)}
          </Button>
        }
        icon={<Wifi />}
        classes={{
          menuContent: styles['network-menu-content'],
        }}
      >
        <span className={clsx(styles['network-item'])}>
          {formatMessage(messages.networkPanelSSIDLabel, {
            ssid: ssid ?? '-',
          })}
        </span>
        <span className={clsx(styles['network-item'])}>
          {formatMessage(messages.networkPanelIPLabel, {
            ipAddress: ipAddress ?? '-',
          })}
        </span>
        <span
          className={clsx(styles['network-status'], {
            [styles['connected']]: isConnected,
          })}
        >
          {isConnected
            ? formatMessage(messages.networkPanelConnectedStatus)
            : formatMessage(messages.networkPanelNotConnectedStatus)}
        </span>
      </Panel>
    );
  },
);
NetworkPanel.displayName = 'NetworkPanel';

export default NetworkPanel;
