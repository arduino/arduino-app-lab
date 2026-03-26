import { AppLabInfo } from '@cloud-editor-mono/images/assets/icons';
import { appLabBoardPreparation } from '@cloud-editor-mono/images/assets/images/images-by-app/app-lab';
import {
  useI18n,
  useTooltip,
  XSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import styles from '../../flasher.module.scss';
import { messages } from '../../messages';
import stepStyles from './flasher-preparation.module.scss';

export const FlasherPreparation: React.FC = () => {
  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    title: formatMessage(messages.preparationStepInstruction2TooltipTitle),
    content: formatMessage(messages.preparationStepInstruction2TooltipContent),
  });

  return (
    <div className={styles['step-container']}>
      <div className={styles['step-card']}>
        <div>
          <div className={stepStyles['instruction-image']}>
            {appLabBoardPreparation}
          </div>
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
                  {renderTooltip(stepStyles['tooltip-content'])}
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
