import {
  Board,
  CloseX,
  MediaLibraryBooksNormal,
  Reset,
} from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';

import { Button } from '../../../../../essential/button';
import { Checkbox } from '../../../../../essential/checkbox';
import { IconButton } from '../../../../../essential/icon-button';
import { useI18n } from '../../../../../i18n/useI18n';
import { TextSize, XXSmall } from '../../../../../typography';
import { sketchPlanMessages } from '../../messages';
import styles from './sketch-plan.module.scss';

export interface SketchPlan {
  libraries: string[];
  codeInstructions: string[];
  board?: string;
  components: string[];
}

type SketchPlanProps = {
  sketchPlan: SketchPlan;
  onConfirm?: (generateDiagram: boolean) => void;
  onCancel?: () => void;
  onRegenerate?: () => void;
};

const SketchPlan: React.FC<SketchPlanProps> = ({
  sketchPlan,
  onConfirm,
  onCancel,
  onRegenerate,
}: SketchPlanProps) => {
  const { formatMessage } = useI18n();

  const [generateDiagram, setGenerateDiagram] = useState(false);

  return (
    <div className={styles['sketch-plan-container']}>
      <div className={styles['sketch-plan-body']}>
        <div className={styles['sketch-plan-components']}>
          <div className={styles['sketch-plan-board']}>
            <Board height={12} width={12} />
            <XXSmall>{sketchPlan.board}</XXSmall>
          </div>
          {sketchPlan.components.map((c, i) => (
            <XXSmall key={i}>{c}</XXSmall>
          ))}
        </div>

        <div className={styles['sketch-plan-libraries']}>
          <MediaLibraryBooksNormal height={16} width={16} />
          {sketchPlan.libraries.map((lib, i) => (
            <XXSmall key={i}>{lib}</XXSmall>
          ))}
        </div>

        <div className={styles['sketch-plan-instructions']}>
          <XXSmall bold>
            {formatMessage(sketchPlanMessages.instructionsTitle)}
          </XXSmall>
          <XXSmall>
            <ul>
              {sketchPlan.codeInstructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </XXSmall>
        </div>

        <Checkbox
          classes={{ label: styles['hidden'] }}
          isSelected={generateDiagram}
          onChange={(isSelected): void => setGenerateDiagram(isSelected)}
        >
          {formatMessage(sketchPlanMessages.diagramCheckboxLabel)}
        </Checkbox>
      </div>

      {onConfirm && onCancel && onRegenerate && (
        <div className={styles['sketch-plan-actions']}>
          <IconButton
            onPress={onRegenerate}
            label={formatMessage(sketchPlanMessages.regenerateButton)}
            Icon={Reset}
            classes={{ button: styles['sketch-plan-icon-button'] }}
          />
          <IconButton
            onPress={onCancel}
            label={formatMessage(sketchPlanMessages.cancelButton)}
            Icon={CloseX}
            classes={{ button: styles['sketch-plan-icon-button'] }}
          />
          <Button
            size={TextSize.XSmall}
            classes={{
              button: styles['sketch-plan-main-button'],
            }}
            onClick={(): void => onConfirm(generateDiagram)}
          >
            {formatMessage(sketchPlanMessages.confirmButton)}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SketchPlan;
