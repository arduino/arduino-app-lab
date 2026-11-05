import { BrickSettings as BrickSettingsIcon } from '@cloud-editor-mono/images/assets/icons';
import { BrickDetails } from '@cloud-editor-mono/infrastructure';

import { useI18n } from '../../../../../i18n/useI18n';
import { XSmall } from '../../../../../typography';
import { AiBadge } from '../../../ai-badge';
import BrickIcon from '../../../brick-icon/BrickIcon';
import { Button, ButtonSize, ButtonVariant } from '../../../essential/button';
import { useTooltip } from '../../../essential/tooltip';
import { messages } from '../../messages';
import styles from './brick-header.module.scss';

export interface BrickHeaderProps {
  brick?: BrickDetails;
  onConfigure?: () => void;
}

export const BrickHeader: React.FC<BrickHeaderProps> = ({
  brick,
  onConfigure,
}: BrickHeaderProps) => {
  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.configureButton),
  });

  const hasAiModels = (brick?.compatible_models ?? []).length !== 0;
  const canConfigure =
    !!onConfigure && (brick?.config_variables ?? []).length > 0;

  return (
    <div className={styles['header']}>
      <BrickIcon category={brick?.category} size="small" />
      <XSmall bold className={styles['title']}>
        {brick?.name}
      </XSmall>
      {hasAiModels && <AiBadge />}
      <div className={styles['spacer']} />
      {canConfigure && (
        <div {...tooltipProps}>
          <Button
            onClick={onConfigure}
            Icon={BrickSettingsIcon}
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Secondary}
          >
            {formatMessage(messages.configureButton)}
          </Button>
          {renderTooltip()}
        </div>
      )}
    </div>
  );
};
