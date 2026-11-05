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

import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../typography';
import styles from './ai-model.module.scss';
import { AiModelProps } from './AiModel.type';
import {
  canDownloadModel,
  getAiModelCardState,
  getModelDisplayName,
} from './helpers';
import { messages } from './messages';
import { AiModelDetailsSkeleton } from './subcomponents/ai-model-details-skeleton/AiModelDetailsSkeleton';
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
    isReadOnlyApp,
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
    isReadOnlyApp,
    readOnly,
    impulses,
    selectedImpulse,
    impulseInUse,
  });

  const displayName = getModelDisplayName(model);

  const isDownloading = !!modelDownloadInfo?.isDownloading;
  const isUninstallingModel = !!isUninstalling?.(model.id);
  const hideRadio = readOnly; // brick list view

  const showMenu =
    allowsInstallActions && !isUninstallingModel && !isDownloading;
  const showStandardActions =
    !isEdgeImpulse &&
    allowsInstallActions &&
    (canDownloadModel(model) || !!model.isPlaceholder || isUninstallingModel);
  const showEdgeImpulseActions = isEdgeImpulse && allowsInstallActions;

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(
      isReadOnlyApp
        ? messages.aiModelReadOnlyAppTooltip
        : messages.aiModelDownloadToEnableTooltip,
    ),
    direction: 'right',
  });
  const showTooltip = isReadOnlyApp || !isModelInstalled;

  return (
    <div
      className={clsx(styles['ai-model-card'], {
        [styles['selectable']]: isSelectable,
        [styles['selected']]: isModelInUse || isModelSelected,
        [styles['disabled']]: isDisabled,
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
            {showTooltip && renderTooltip()}
          </div>
        ) : null}
        <div className={styles['ai-model-details']}>
          <div className={styles['ai-model-header']}>
            <XSmall className={styles['ai-model-name']}>
              {displayName.title}
            </XSmall>
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
          {model.isPlaceholder ? (
            <AiModelDetailsSkeleton />
          ) : (
            <>
              <div className={styles['ai-model-description-container']}>
                <XXSmall truncate className={styles['ai-model-description']}>
                  {model.description || displayName.repository}
                </XXSmall>
              </div>
              <AiModelTags
                model={model}
                selectedImpulseId={selectedImpulse?.id}
                openModelPage={openModelPage}
              />
            </>
          )}
        </div>
        {showMenu ? (
          <AiModelMenu
            model={model}
            isEdgeImpulse={isEdgeImpulse}
            selectedImpulse={selectedImpulse}
            openModelPage={openModelPage}
            removeModel={removeModel}
            forceRemove={isModelInUse || !!isInstalledInApp}
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
          onModelSelect={isReadOnlyApp ? undefined : onModelSelect}
          downloadEIModel={downloadEIModel}
        />
      ) : null}
    </div>
  );
};
