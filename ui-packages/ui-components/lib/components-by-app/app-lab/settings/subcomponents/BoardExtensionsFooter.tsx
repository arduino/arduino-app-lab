import { InfoSetup } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonSize,
  useI18n,
  useTooltip,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { boardExtensionsMessages } from '../messages';
import styles from '../settings.module.scss';

export interface BoardExtensionsFooterProps {
  openPasswordDialog: () => void;
}

export const BoardExtensionsFooter = ({
  openPasswordDialog,
}: BoardExtensionsFooterProps): JSX.Element => {
  const { formatMessage } = useI18n();

  const { props: tooltipPropsCarrier, renderTooltip: renderTooltipCarrier } =
    useTooltip({
      content: formatMessage(boardExtensionsMessages.applyButton),
    });

  return (
    <div className={styles['extensions-footer']}>
      <div className={styles['extensions-footer-label']}>
        <InfoSetup />
        <XXXSmall>{formatMessage(boardExtensionsMessages.applyInfo)}</XXXSmall>
      </div>
      <div {...tooltipPropsCarrier} className={styles['tooltip-wrapper']}>
        <Button size={ButtonSize.XSmall} onClick={openPasswordDialog}>
          {formatMessage(boardExtensionsMessages.applyButton)}
        </Button>
        {renderTooltipCarrier()}
      </div>
    </div>
  );
};
