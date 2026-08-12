import { Sparkle } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  Text,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { useAgentModeBannerLogic } from './agentModeBanner.logic';
import styles from './agentModeBanner.module.scss';
import { messages } from './messages';

const AgentModeBanner: React.FC = () => {
  const { formatMessage } = useI18n();
  const { visible, onConfigure } = useAgentModeBannerLogic();

  if (!visible) {
    return null;
  }

  return (
    <div className={styles['banner']}>
      <div className={styles['header']}>
        <Sparkle className={styles['icon']} aria-hidden="true" />
        <Text size={TextSize.XXSmall} className={styles['title']}>
          {formatMessage(messages.title)}
        </Text>
      </div>
      <Text size={TextSize.XXXSmall} className={styles['description']}>
        {formatMessage(messages.description)}
      </Text>
      <Button
        variant={ButtonVariant.Primary}
        appearance={ButtonAppearance.LowContrast}
        size={ButtonSize.XXSmall}
        classes={{
          button: styles['action'],
          textButtonText: styles['action-text'],
        }}
        onClick={onConfigure}
      >
        {formatMessage(messages.action)}
      </Button>
    </div>
  );
};

export default AgentModeBanner;
