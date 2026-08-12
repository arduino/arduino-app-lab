import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import { messages } from '../../messages';
import { Button } from '../Button/Button';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { Text } from '../Text/Text';
import styles from './agent-action.module.scss';

export interface AgentActionProps {
  // Not available yet: a disabled Install.
  comingSoon?: boolean;
  // Auth options / login flow are open → offer Cancel.
  cancelling?: boolean;
  // Runtime install/update is running → inline spinner + progress bar.
  installing?: boolean;
  installProgressPct?: number;
  // Runtime status still resolving → a loading Install.
  checking?: boolean;
  installed?: boolean;
  connected?: boolean;
  // Disable Install/Connect while a runtime op runs elsewhere.
  busy?: boolean;
  // Rotates the Manage chevron when the details are expanded.
  expanded?: boolean;
  onCancel?: VoidFunction;
  onInstall?: VoidFunction;
  onConnect?: VoidFunction;
  onManage?: VoidFunction;
}

// Trailing action for an AgentCard, shared by the Connect panel and the
// Settings section. States are mutually exclusive and checked in setup-flow
// order: coming-soon → cancel → installing → install → connect → manage.
// (Connect never reaches "manage"; Settings never sets "checking".)
export const AgentAction: React.FC<AgentActionProps> = ({
  comingSoon,
  cancelling,
  installing,
  installProgressPct = 0,
  checking,
  installed,
  connected,
  busy,
  expanded,
  onCancel,
  onInstall,
  onConnect,
  onManage,
}) => {
  const { formatMessage } = useI18n();

  if (comingSoon) {
    return (
      <Button
        variant={ButtonVariant.Secondary}
        className={styles['action']}
        disabled
      >
        {formatMessage(messages.install)}
      </Button>
    );
  }

  if (cancelling) {
    return (
      <Button
        variant={ButtonVariant.Tertiary}
        appearance={ButtonAppearance.LowContrast}
        className={styles['action']}
        onClick={onCancel}
      >
        {formatMessage(messages.cancel)}
      </Button>
    );
  }

  if (installing) {
    const pct = Math.max(0, Math.min(100, Math.round(installProgressPct)));
    return (
      <div className={styles['installing']}>
        <div className={styles['installing-inline']}>
          <span className={styles['installing-spinner']} aria-hidden="true" />
          <Text className={styles['installing-text']}>
            {formatMessage(messages.installing)}
          </Text>
        </div>
        <ProgressBar
          className={styles['installing-bar']}
          value={pct}
          label={formatMessage(messages.installing)}
        />
      </div>
    );
  }

  if (checking || !installed) {
    return (
      <Button
        variant={ButtonVariant.Secondary}
        className={styles['action']}
        loading={checking}
        disabled={busy || checking}
        onClick={onInstall}
      >
        {formatMessage(messages.install)}
      </Button>
    );
  }

  if (!connected) {
    return (
      <Button
        variant={ButtonVariant.Secondary}
        className={styles['action']}
        disabled={busy}
        onClick={onConnect}
      >
        {formatMessage(messages.connect)}
      </Button>
    );
  }

  return (
    <Button
      variant={ButtonVariant.Tertiary}
      className={clsx(styles['action'], styles['manage'], {
        [styles['manage--expanded']]: expanded,
      })}
      Icon={ChevronDown}
      iconPosition="right"
      onClick={onManage}
    >
      {formatMessage(messages.settingsManage)}
    </Button>
  );
};

export default AgentAction;
