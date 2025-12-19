import clsx from 'clsx';

import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../typography';
import { messages } from '../../messages';
import styles from './ai-model.module.scss';
import { AppLabAiModelProps } from './AiModel.type';

export const AppLabAiModel: React.FC<AppLabAiModelProps> = (
  props: AppLabAiModelProps,
) => {
  const { formatMessage } = useI18n();
  const { inUseModelId, model, selectedModelId, onClick } = props;

  return (
    <div
      className={clsx(styles['ai-model-card'], {
        [styles['selectable']]: !!onClick,
        [styles['selected']]: !!onClick && model.id === selectedModelId,
      })}
      {...(onClick && {
        onClick: (): void => onClick(model.id!),
      })}
    >
      {onClick && <div className={styles['radio']} />}
      <div className={styles['ai-model-card-container']}>
        <XSmall className={styles['ai-model-name']}>{model.name}</XSmall>
        {model.id === inUseModelId && (
          <div>
            <span className={styles['ai-model-in-use']}>
              {formatMessage(messages.aiModelInUse)}
            </span>
          </div>
        )}
        <XXSmall className={styles['ai-model-description']}>
          {model.description}
        </XXSmall>
      </div>
    </div>
  );
};
