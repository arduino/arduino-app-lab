import { IconFileLoadDownloadArrow } from '@arduino/react-icons';
import { Warning } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  ProgressBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { IntRange } from 'type-fest';

import { ArcSpinner } from '../../../../../essential/loader';
import { XXSmall } from '../../../../../typography';
import styles from '../../ai-model.module.scss';
import { AiModelProps } from '../../AiModel.type';
import { messages } from '../../messages';

export interface AiModelStandardActionsProps {
  model: AiModelProps['model'];
  modelDownloadInfo?: AiModelProps['modelDownloadInfo'];
  downloadGenericModel?: AiModelProps['downloadGenericModel'];
  diskUsageWarning?: AiModelProps['diskUsageWarning'];
  isUninstalling?: AiModelProps['isUninstalling'];
}

/**
 * Download / uninstall actions for non-Edge-Impulse downloadable models
 * (e.g. Hugging Face, QC AI Hub). Renders nothing for models without a
 * downloadable source.
 */
export const AiModelStandardActions: React.FC<AiModelStandardActionsProps> = ({
  model,
  modelDownloadInfo,
  downloadGenericModel,
  diskUsageWarning,
  isUninstalling,
}: AiModelStandardActionsProps) => {
  const { formatMessage } = useI18n();

  // order matters here: uninstalling takes precedence over installed,
  // since a model in the process of being uninstalled is still technically installed
  // but we want to show the uninstalling state instead of the installed state.
  if (isUninstalling?.(model.id)) {
    return (
      <div className={styles['uninstall-progress']}>
        <ArcSpinner />
        <XXSmall className={styles['ai-model-uninstall-progress-text']}>
          {formatMessage(messages.aiModelUninstallingLabel)}
        </XXSmall>
      </div>
    );
  }

  if (modelDownloadInfo?.isDownloading) {
    return (
      <div className={styles['download-progress']}>
        <ArcSpinner />
        <XXSmall className={styles['ai-model-download-progress-text']}>
          {formatMessage(messages.aiModelDownloadingLabel, {
            progress: Math.round(modelDownloadInfo?.percentage ?? 0),
          })}
        </XXSmall>
        <ProgressBar
          classes={{
            progressBar: styles['ai-model-download-progress-bar'],
          }}
          active={true}
          progress={(modelDownloadInfo?.percentage ?? 0) as IntRange<0, 101>}
        />
      </div>
    );
  }

  return (
    <>
      <Button
        variant={ButtonVariant.Secondary}
        appearance={ButtonAppearance.Action}
        size={ButtonSize.XXSmall}
        onClick={(e): void => {
          e.stopPropagation();
          downloadGenericModel && downloadGenericModel(model.id);
        }}
        classes={{
          button: styles['ai-model-download-button'],
        }}
      >
        <span>{formatMessage(messages.aiModelDownloadLabel)}</span>
        <IconFileLoadDownloadArrow />
      </Button>
      {diskUsageWarning && (
        <div className={styles['disk-warning']}>
          <Warning />
          <XXSmall className={styles['disk-warning-text']}>
            {formatMessage(messages.aiModelDiskUsageWarning, {
              used: diskUsageWarning.used,
              total: diskUsageWarning.total,
            })}
          </XXSmall>
        </div>
      )}
    </>
  );
};
