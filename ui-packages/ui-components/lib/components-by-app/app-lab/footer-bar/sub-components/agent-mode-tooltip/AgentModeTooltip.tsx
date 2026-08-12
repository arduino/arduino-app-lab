import {
  CloseX,
  CodeIcon,
  Sparkle,
} from '@cloud-editor-mono/images/assets/icons';
import {
  useI18n,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { AgentModeTooltipVariant } from '../../FooterBar.type';
import { messages } from '../../messages';
import styles from './agent-mode-tooltip.module.scss';

interface AgentModeTooltipProps {
  variant: AgentModeTooltipVariant;
  onDismiss: () => void;
}

const content = {
  [AgentModeTooltipVariant.BackToIde]: {
    Icon: CodeIcon,
    title: messages.backToIdeTooltipTitle,
    description: messages.backToIdeTooltipDescription,
  },
  [AgentModeTooltipVariant.AgentIsHere]: {
    Icon: Sparkle,
    title: messages.agentIsHereTooltipTitle,
    description: messages.agentIsHereTooltipDescription,
  },
};

export const AgentModeTooltip: React.FC<AgentModeTooltipProps> = ({
  variant,
  onDismiss,
}: AgentModeTooltipProps) => {
  const { formatMessage } = useI18n();
  const { Icon, title, description } = content[variant];

  return (
    <div className={styles['tooltip']} role="status">
      <div className={styles['header']}>
        <Icon className={styles['icon']} aria-hidden="true" />
        <XXSmall className={styles['title']}>{formatMessage(title)}</XXSmall>
        <button
          type="button"
          className={styles['dismiss']}
          aria-label={formatMessage(messages.dismissTooltip)}
          onClick={onDismiss}
        >
          <CloseX aria-hidden="true" />
        </button>
      </div>
      <XXSmall className={styles['description']}>
        {formatMessage(description)}
      </XXSmall>
    </div>
  );
};
