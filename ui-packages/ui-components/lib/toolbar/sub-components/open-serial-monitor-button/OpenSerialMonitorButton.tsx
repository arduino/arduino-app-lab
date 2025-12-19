import { Monitor } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useCallback } from 'react';

import { IconButton } from '../../../essential/icon-button';
import { useI18n } from '../../../i18n/useI18n';
import { useTooltip } from '../../../tooltip';
import { messages } from '../../messages';
import styles from './open-serial-monitor-button.module.scss';

export interface OpenSerialMonitorButtonProps {
  onClick?: (width?: number, height?: number) => void;
  disabled: boolean;
  serialMonitorIsBusy: boolean;
}

const OpenSerialMonitorButton: React.FC<OpenSerialMonitorButtonProps> = (
  props: OpenSerialMonitorButtonProps,
) => {
  const { onClick, disabled, serialMonitorIsBusy } = props;

  const { formatMessage } = useI18n();
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(
      serialMonitorIsBusy
        ? messages.serialPortBusyDescription
        : messages.serialPortUnavailableDescription,
    ),
    title: formatMessage(
      serialMonitorIsBusy
        ? messages.serialPortBusy
        : messages.serialPortUnavailable,
    ),
  });

  const handleClick = useCallback(() => {
    onClick && !disabled && onClick();
  }, [disabled, onClick]);

  return (
    <div
      id="serial-monitor"
      className={styles['open-serial-monitor-button-wrapper']}
    >
      <IconButton
        onPress={handleClick}
        label={formatMessage(messages.serialMonitor)}
        title={formatMessage(messages.serialMonitor)}
        Icon={Monitor}
        classes={{
          button: clsx(
            styles['open-serial-monitor-button'],
            disabled && styles['open-serial-monitor-button-disabled'],
          ),
        }}
        {...tooltipProps}
      >
        {formatMessage(messages.serialMonitor)}
      </IconButton>
      {disabled && renderTooltip()}
    </div>
  );
};

export default OpenSerialMonitorButton;
