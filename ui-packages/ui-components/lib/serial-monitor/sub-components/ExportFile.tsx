import { Download } from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../essential/icon-button';
import { useI18n } from '../../i18n/useI18n';
import { messages } from '../messages';
import styles from './serial-monitor-toolbar.module.scss';

export interface ToggleTimestampsButtonProps {
  onClick: () => void;
  disabled: boolean;
}

const ToggleTimestampsButton: React.FC<ToggleTimestampsButtonProps> = (
  props: ToggleTimestampsButtonProps,
) => {
  const { onClick: handleClick, disabled } = props;

  const { formatMessage } = useI18n();

  return (
    <IconButton
      onPress={handleClick}
      label={formatMessage(messages.downloadLog)}
      title={formatMessage(messages.downloadLog)}
      Icon={Download}
      classes={{
        button: styles['export-file-button'],
      }}
      isDisabled={disabled}
    />
  );
};

export default ToggleTimestampsButton;
