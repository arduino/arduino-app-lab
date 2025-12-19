import {
  StopWatch,
  StopWatchDisable,
} from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../essential/icon-button';
import { useI18n } from '../../i18n/useI18n';
import { messages } from '../messages';
import styles from './serial-monitor-toolbar.module.scss';

export interface ToggleTimestampsButtonProps {
  onClick: () => void;
  disabled: boolean;
  timestampsActive: boolean;
}

const ToggleTimestampsButton: React.FC<ToggleTimestampsButtonProps> = (
  props: ToggleTimestampsButtonProps,
) => {
  const { onClick: handleClick, disabled, timestampsActive } = props;

  const { formatMessage } = useI18n();

  return (
    <IconButton
      onPress={handleClick}
      label={formatMessage(
        timestampsActive ? messages.hideTimestamp : messages.showTimestamp,
      )}
      title={formatMessage(
        timestampsActive ? messages.hideTimestamp : messages.showTimestamp,
      )}
      Icon={timestampsActive ? StopWatchDisable : StopWatch}
      classes={{
        button: styles['toggle-timestamps-button'],
      }}
      isDisabled={disabled}
    />
  );
};

export default ToggleTimestampsButton;
