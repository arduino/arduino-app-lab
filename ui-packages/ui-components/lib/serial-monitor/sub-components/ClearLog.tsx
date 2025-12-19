import { Clear } from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../essential/icon-button';
import { useI18n } from '../../i18n/useI18n';
import { messages } from '../messages';
import styles from './serial-monitor-toolbar.module.scss';

export interface ClearLogButtonProps {
  onClick: () => void;
  disabled: boolean;
}

const ClearLogButton: React.FC<ClearLogButtonProps> = (
  props: ClearLogButtonProps,
) => {
  const { onClick: handleClick, disabled } = props;

  const { formatMessage } = useI18n();

  return (
    <IconButton
      onPress={handleClick}
      label={formatMessage(messages.clearLog)}
      title={formatMessage(messages.clearLog)}
      Icon={Clear}
      classes={{
        button: styles['clear-log-button'],
      }}
      isDisabled={disabled}
    />
  );
};

export default ClearLogButton;
