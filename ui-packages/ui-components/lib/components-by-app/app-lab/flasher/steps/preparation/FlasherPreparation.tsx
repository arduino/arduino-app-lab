import { AppLabInfo } from '@cloud-editor-mono/images/assets/icons';
import {
  useI18n,
  useTooltip,
  XSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { ReactNode } from 'react';

import styles from '../../flasher.module.scss';
import { messages } from '../../messages';
import stepStyles from './flasher-preparation.module.scss';

interface FlashPreparationProps {
  // Where the boot-mode jumper goes on the board being flashed.
  image: ReactNode;
}

export const FlasherPreparation: React.FC<FlashPreparationProps> = ({
  image,
}: FlashPreparationProps) => {
  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    title: formatMessage(messages.preparationStepInstruction2TooltipTitle),
    content: formatMessage(messages.preparationStepInstruction2TooltipContent),
    variant: 'card',
  });

  return (
    <div className={styles['step-container']}>
      <div className={styles['step-card']}>
        <div>
          <div className={stepStyles['instruction-image']}>{image}</div>
          <XSmall>{formatMessage(messages.preparationStepDescription)}</XSmall>
          <ol className={stepStyles['instruction-list']}>
            <li className={stepStyles['instruction-list-item']}>
              <XSmall>
                {formatMessage(messages.preparationStepInstruction1, {
                  bold: (text: string) => <b>{text}</b>,
                })}
              </XSmall>
            </li>
            <li className={stepStyles['instruction-list-item']}>
              <div className={stepStyles['instruction-list-item-with-tooltip']}>
                <XSmall>
                  {formatMessage(messages.preparationStepInstruction2, {
                    bold: (text: string) => <b>{text}</b>,
                  })}
                </XSmall>
                <div {...tooltipProps}>
                  <div className={stepStyles['info-icon']}>
                    <AppLabInfo />
                  </div>
                  {renderTooltip()}
                </div>
              </div>
            </li>
            <li className={stepStyles['instruction-list-item']}>
              <XSmall>
                {formatMessage(messages.preparationStepInstruction3, {
                  bold: (text: string) => <b>{text}</b>,
                })}
              </XSmall>
            </li>
          </ol>
        </div>
      </div>
      <div className={stepStyles['step-footer']}>
        <XSmall className={stepStyles['waiting-label']}>
          {formatMessage(messages.preparationStepWaitingLabel)}
        </XSmall>
        <div className={styles['waiting-indicator']}>
          <div className={styles['indicator']} />
        </div>
      </div>
    </div>
  );
};
