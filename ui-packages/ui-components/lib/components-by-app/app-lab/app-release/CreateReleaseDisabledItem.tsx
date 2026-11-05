import { AppRelease } from '@cloud-editor-mono/images/assets/icons';

import { useI18n } from '../../../i18n/useI18n';
import { XXSmall } from '../../../typography';
import { useTooltip } from '../essential/tooltip';
import styles from './app-release.module.scss';
import { appReleaseMessages as messages } from './messages';

interface CreateReleaseDisabledItemProps {
  reason: string;
}

// The content of a disabled "Create release" menu item, with the reason in a tooltip.
export const CreateReleaseDisabledItem: React.FC<
  CreateReleaseDisabledItemProps
> = ({ reason }: CreateReleaseDisabledItemProps) => {
  const { formatMessage } = useI18n();
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: reason,
    timeout: 0,
    zIndex: 999999,
  });

  return (
    <span {...tooltipProps} className={styles['disabled-item']}>
      <span className={styles['disabled-item-icon']}>
        <AppRelease />
      </span>
      <XXSmall>{formatMessage(messages.actionCreateRelease)}</XXSmall>
      {renderTooltip(styles['disabled-item-tooltip'])}
    </span>
  );
};
