import { Pause, Run } from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../essential/icon-button';
import { useI18n } from '../../i18n/useI18n';
import { messages } from '../messages';
import { SerialMonitorStatus } from '../SerialMonitor.type';
import styles from './serial-monitor-toolbar.module.scss';

export interface PlayPauseButtonProps {
  onClick: () => void;
  status: SerialMonitorStatus;
  disabled: boolean;
}

const PlayPauseButton: React.FC<PlayPauseButtonProps> = (
  props: PlayPauseButtonProps,
) => {
  const { onClick: handleClick, status, disabled } = props;

  const { formatMessage } = useI18n();

  const isActive =
    status === SerialMonitorStatus.Active ||
    status === SerialMonitorStatus.ActiveUnreachable;

  const message = isActive
    ? formatMessage(messages.pause)
    : formatMessage(messages.run);

  const icon = isActive ? Pause : Run;

  return (
    <IconButton
      onPress={handleClick}
      label={message}
      title={message}
      Icon={icon}
      classes={{
        button: styles['play-pause-button'],
      }}
      isDisabled={disabled}
    />
  );
};

export default PlayPauseButton;
