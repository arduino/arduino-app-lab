import { getPropertyByName } from '@cloud-editor-mono/common';
import { ArrowUpRight } from '@cloud-editor-mono/images/assets/icons';
import { useI18n } from '@cloud-editor-mono/ui-components';
import {
  Button,
  ButtonSize,
  ButtonVariant,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMemo } from 'react';

import { XXSmall } from '../../../../../typography';
import { aiModelMessages } from '../../../brick-detail/messages';
import styles from '../../ai-model.module.scss';
import { AiModelProps } from '../../AiModel.type';
import { allowedMetadataTags } from '../../helpers';

export interface AiModelTagsProps {
  model: AiModelProps['model'];
  selectedImpulseId?: string;
  openModelPage?: AiModelProps['openModelPage'];
}

/** Renders the metadata tags and the "Model card" link for a model. */
export const AiModelTags: React.FC<AiModelTagsProps> = ({
  model,
  selectedImpulseId,
  openModelPage,
}: AiModelTagsProps) => {
  const { formatMessage } = useI18n();

  const modelTags = useMemo(
    () =>
      Object.values(allowedMetadataTags)
        .sort((a, b) => a.order - b.order)
        .filter((tag) => getPropertyByName(model, tag.path) !== null)
        .map((tag) => (
          <div className={styles[tag.className]} key={tag.path}>
            <div className={styles['ai-model-tag']}>
              <XXSmall className={styles['ai-model-tag-label']}>
                {tag.icon}
                {tag.label && tag.label + ': '}
              </XXSmall>
              <XXSmall>
                {tag.formatFn(getPropertyByName(model, tag.path) ?? '--')}
              </XXSmall>
            </div>
          </div>
        )),
    [model],
  );

  return (
    <div className={styles['ai-model-tags']}>
      {modelTags}
      <div className={styles['model-card-button-container']}>
        <Button
          size={ButtonSize.XXSmall}
          variant={ButtonVariant.Tertiary}
          onClick={(e): void => {
            e.stopPropagation();
            if (model.edgeImpulseProps) {
              openModelPage?.(
                model.edgeImpulseProps.projectId,
                selectedImpulseId,
              );
            } else {
              openModelPage?.(model.id);
            }
          }}
          classes={{
            button: styles['model-card-button'],
          }}
        >
          {formatMessage(aiModelMessages.modelCard)}
          <div className={styles['model-card-button-icon']}>
            <ArrowUpRight />
          </div>
        </Button>
      </div>
    </div>
  );
};
