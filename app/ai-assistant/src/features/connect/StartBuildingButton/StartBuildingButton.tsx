import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../messages';
import { Button } from '../../../ui';
import styles from './start-building-button.module.scss';

type StartBuildingButtonProps = {
  loading?: boolean;
  disabled?: boolean;
  onClick: VoidFunction;
};

// Starts a free agent with the provider keys added so far, from the Connect panel and from Settings.
export const StartBuildingButton: React.FC<StartBuildingButtonProps> = ({
  loading,
  disabled,
  onClick,
}) => {
  const { formatMessage } = useI18n();
  return (
    <Button
      size="small"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      className={styles['start-btn']}
    >
      {formatMessage(messages.startBuilding)}
    </Button>
  );
};

export default StartBuildingButton;
