import { useI18n } from '@cloud-editor-mono/ui-components';
import {
  AiModelUninstallDialog,
  Badge,
  BadgeSize,
  BadgeStyle,
  BadgeVariant,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useState } from 'react';

import { XSmall, XXSmall } from '../../../typography';
import styles from './ai-model.module.scss';
import { AiModelProps } from './AiModel.type';
import { canDownloadModel, getAiModelCardState } from './helpers';
import { messages } from './messages';
import { AiModelEdgeImpulseActions } from './subcomponents/ai-model-edge-impulse/AiModelEdgeImpulseActions';
import { useEdgeImpulseModel } from './subcomponents/ai-model-edge-impulse/useEdgeImpulseModel';
import { AiModelStandardActions } from './subcomponents/ai-model-standard-actions/AiModelStandardActions';
import { AiModelTags } from './subcomponents/ai-model-tags/AiModelTags';
import { AiModelMenu } from './subcomponents/AiModelMenu';

export const AiModel: React.FC<AiModelProps> = (props: AiModelProps) => {
  const { formatMessage } = useI18n();
  const {
    inUseModelId,
    selectedModelId,
    model,
    onModelSelect,
    downloadEIModel,
    downloadGenericModel,
    removeModel,
    openModelPage,
    diskUsageWarning,
    modelDownloadInfo,
    readOnly,
    isExample,
    isUninstalling,
    isInstalledInApp,
  } = props;

  const [isModelUninstallDialogOpen, setIsModelUninstallDialogOpen] =
    useState(false);

  const { impulses, setSelectedImpulseId, selectedImpulse, impulseInUse } =
    useEdgeImpulseModel(model, inUseModelId, readOnly);

  const {
    isEdgeImpulse,
    isModelInstalled,
    isModelInUse,
    isModelSelected,
    isSelectable,
    isDisabled,
    allowsInstallActions,
  } = getAiModelCardState({
    model,
    inUseModelId,
    selectedModelId,
    isExample,
    readOnly,
    impulses,
    selectedImpulse,
    impulseInUse,
  });

  const isDownloading = !!modelDownloadInfo?.isDownloading;
  const isUninstallingModel = !!isUninstalling?.(model.id);
  const hideRadio = readOnly; // brick list view

  const showMenu =
    allowsInstallActions && !isUninstallingModel && !isDownloading;
  const showStandardActions =
    allowsInstallActions && (canDownloadModel(model) || isUninstallingModel);
  const showEdgeImpulseActions = isEdgeImpulse && allowsInstallActions;

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(
      isExample
        ? messages.aiModelExampleTooltip
        : messages.aiModelDownloadToEnableTooltip,
    ),
    direction: 'right',
    timeout: 0,
  });
  const showTooltip = isExample || !isModelInstalled;

  return (
    <div
      className={clsx(styles['ai-model-card'], {
        [styles['selectable']]: isSelectable,
        [styles['selected']]: isModelInUse || isModelSelected,
        [styles['disabled']]: isDisabled,
        [styles['disabled-radio-only']]: readOnly || isExample,
      })}
      {...(isSelectable &&
        onModelSelect && {
          onClick: (): void =>
            onModelSelect(selectedImpulse?.installedModelId || model.id),
        })}
    >
      <AiModelUninstallDialog
        open={isModelUninstallDialogOpen}
        isEdgeImpulse={isEdgeImpulse}
        modelId={model.id}
        selectedImpulse={selectedImpulse}
        onOpenChange={setIsModelUninstallDialogOpen}
        removeModel={removeModel}
      />
      <div className={styles['ai-model-container']}>
        {!hideRadio ? (
          <div className={styles['radio']} {...tooltipProps}>
            {showTooltip && renderTooltip(styles['radio-tooltip'])}
          </div>
        ) : null}
        <div className={styles['ai-model-details']}>
          <div className={styles['ai-model-header']}>
            <XSmall className={styles['ai-model-name']}>{model.name}</XSmall>
            {isModelInUse && isModelInstalled && (
              <Badge
                size={BadgeSize.Small}
                style={BadgeStyle.Solid}
                variant={BadgeVariant.Positive}
                classes={{ container: styles['ai-model-in-use'] }}
              >
                {formatMessage(messages.aiModelInUse)}
              </Badge>
            )}
            {/*
              Only badge the in-use impulse when it has a name. Unlinked
              "special" Edge Impulse models exposed by the board have no
              `ei-impulse-name`, so this would otherwise render an empty badge.
            */}
            {isModelInUse && !!impulseInUse?.name ? (
              <Badge
                size={BadgeSize.Small}
                style={BadgeStyle.Light}
                variant={BadgeVariant.Neutral}
                classes={{ container: styles['ai-impulse-in-use'] }}
              >
                {impulseInUse.name}
              </Badge>
            ) : null}
          </div>
          <div className={styles['ai-model-description-container']}>
            <XXSmall truncate className={styles['ai-model-description']}>
              {model.description}
            </XXSmall>
          </div>
          <AiModelTags
            model={model}
            selectedImpulseId={selectedImpulse?.id}
            openModelPage={openModelPage}
          />
        </div>
        {showMenu ? (
          <AiModelMenu
            model={model}
            isEdgeImpulse={isEdgeImpulse}
            selectedImpulse={selectedImpulse}
            openModelPage={openModelPage}
            removeModel={removeModel}
            forceRemove={isModelInUse || isModelSelected || !!isInstalledInApp}
            openForceRemoveDialog={(): void =>
              setIsModelUninstallDialogOpen(true)
            }
          />
        ) : null}
        {showStandardActions ? (
          <div className={styles['ai-model-download-container']}>
            <AiModelStandardActions
              model={model}
              modelDownloadInfo={modelDownloadInfo}
              downloadGenericModel={downloadGenericModel}
              diskUsageWarning={diskUsageWarning}
              isUninstalling={isUninstalling}
            />
          </div>
        ) : null}
      </div>
      {showEdgeImpulseActions ? (
        <AiModelEdgeImpulseActions
          model={model}
          impulses={impulses}
          selectedImpulse={selectedImpulse}
          inUseModelId={inUseModelId}
          isModelInUse={isModelInUse}
          isDownloading={isDownloading}
          diskUsageWarning={diskUsageWarning}
          setSelectedImpulseId={setSelectedImpulseId}
          onModelSelect={isExample ? undefined : onModelSelect}
          downloadEIModel={downloadEIModel}
        />
      ) : null}
    </div>
  );
};
