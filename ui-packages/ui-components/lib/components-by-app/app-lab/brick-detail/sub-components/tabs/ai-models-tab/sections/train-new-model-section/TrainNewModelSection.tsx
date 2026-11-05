import {
  InfoIconI,
  OpenInNewTab,
} from '@cloud-editor-mono/images/assets/icons';
import { FormattedMessage } from 'react-intl';

import {
  TrainNewModelDialog,
  TrainNewModelDialogProps,
} from '../../../../../../../../dialogs/app-lab/train-new-model-dialog/TrainNewModelDialog';
import { useI18n } from '../../../../../../../../i18n/useI18n';
import { XXSmall } from '../../../../../../../../typography';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../../../../../../essential/button';
import { useTooltip } from '../../../../../../essential/tooltip';
import { messages } from '../../../../../messages';
import styles from './train-new-model-section.module.scss';

export interface TrainNewModelSectionProps {
  onTrainNewModelClick: () => void;
  trainNewModelDialogProps?: TrainNewModelDialogProps;
  hideAction?: boolean;
  children?: React.ReactNode;
}

export const TrainNewModelSection: React.FC<TrainNewModelSectionProps> = ({
  onTrainNewModelClick,
  trainNewModelDialogProps,
  hideAction = false,
  children,
}: TrainNewModelSectionProps) => {
  const { formatMessage } = useI18n();

  const {
    props: descriptionTooltipProps,
    renderTooltip: renderDescriptionTooltip,
  } = useTooltip({
    content: (
      <FormattedMessage
        {...messages.trainNewModelDescription}
        values={{
          strong: (chunks) => <strong>{chunks}</strong>,
        }}
      />
    ),
    variant: 'card',
  });

  const { props: buttonTooltipProps, renderTooltip: renderButtonTooltip } =
    useTooltip({
      content: formatMessage(messages.trainNewModelButton),
    });

  return (
    <>
      <div className={styles['section']}>
        <div className={styles['header']}>
          <div className={styles['label']}>
            <XXSmall bold className={styles['title']}>
              {formatMessage(messages.trainNewModelSectionTitle)}
            </XXSmall>
            <div {...descriptionTooltipProps} className={styles['info']}>
              <InfoIconI />
              {renderDescriptionTooltip()}
            </div>
          </div>
          {!hideAction && (
            <div {...buttonTooltipProps}>
              <Button
                variant={ButtonVariant.Secondary}
                appearance={ButtonAppearance.LowContrast}
                size={ButtonSize.XSmall}
                onClick={onTrainNewModelClick}
                Icon={OpenInNewTab}
                classes={{
                  button: styles['button'],
                }}
              >
                {formatMessage(messages.trainNewModelButton)}
              </Button>
              {renderButtonTooltip()}
            </div>
          )}
        </div>
        {children}
      </div>
      {!hideAction && trainNewModelDialogProps && (
        <TrainNewModelDialog {...trainNewModelDialogProps} />
      )}
    </>
  );
};
