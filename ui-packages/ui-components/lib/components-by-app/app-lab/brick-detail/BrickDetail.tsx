import {
  BrickSettings as BrickSettingsIcon,
  EdgeImpulse as EdgeImpulseIcon,
  InfoIconOutline,
  OpenInNewTab,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AiModel,
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  ConfigureAppBrickDialog,
  getBackgroundIcon,
  TrainNewModelDialog,
  useI18n,
  XSmall,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useNavigate } from '@tanstack/react-router';
import { Key, useEffect, useState } from 'react';
import { Item } from 'react-stately';

import { ArduinoLoader } from '../../../essential/loader';
import { Tabs } from '../../../essential/tab-list/Tabs';
import BrickIcon from '../brick-icon/BrickIcon';
import { EmojiPreview } from '../emoji-picker/sub-components/EmojiPreview';
import MarkdownReader from '../markdown-reader/MarkdownReader';
import styles from './brick-detail.module.scss';
import { BrickDetailLogic } from './BrickDetail.type';
import { messages } from './messages';
import { AiBadge } from './sub-components/ai-badge/AiBadge';

const DEFAULT_ICON = '⚪'; // Default icon if none is provided

const UsedByAppLinkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.5012 4V10.5C12.5012 10.6326 12.4486 10.7598 12.3548 10.8536C12.261 10.9473 12.1339 11 12.0012 11C11.8686 11 11.7415 10.9473 11.6477 10.8536C11.5539 10.7598 11.5012 10.6326 11.5012 10.5V5.21L4.35624 12.355C4.26145 12.4479 4.13399 12.5 4.00124 12.5C3.86849 12.5 3.74103 12.4479 3.64624 12.355C3.55257 12.2606 3.5 12.133 3.5 12C3.5 11.867 3.55257 11.7394 3.64624 11.645L10.7912 4.5H5.50124C5.36863 4.5 5.24146 4.44732 5.14769 4.35355C5.05392 4.25979 5.00124 4.13261 5.00124 4C5.00124 3.86739 5.05392 3.74021 5.14769 3.64645C5.24146 3.55268 5.36863 3.5 5.50124 3.5H12.0012C12.1337 3.50038 12.2607 3.55318 12.3544 3.64687C12.4481 3.74055 12.5009 3.86751 12.5012 4Z"
      fill="#C9D2D2"
    />
  </svg>
);

const getUsedByAppPath = (appId: string): string => {
  const decodedAppId = window.atob(appId);
  const section = decodedAppId.startsWith('examples:') ? 'examples' : 'my-apps';

  return `/${section}/${appId}`;
};

const tabs = [
  { id: 'overview', label: messages.overviewTab },
  { id: 'examples', label: messages.examplesTab },
  { id: 'documentation', label: messages.documentationTab },
  { id: 'aiModels', label: messages.aiModelsTab },
];

interface BrickDetailProps {
  brickId: string;
  brickDetailLogic: BrickDetailLogic;
  preSelectedModelId?: string;
  preSelectedModelChange?: (id: string) => void;
  selectedTab?: string;
  onSelectedTabChange?: (tab: string) => void;
}

const BrickDetail: React.FC<BrickDetailProps> = ({
  brickId,
  brickDetailLogic,
  preSelectedModelId,
  preSelectedModelChange,
  selectedTab: controlledSelectedTab,
  onSelectedTabChange,
}: BrickDetailProps) => {
  const { formatMessage } = useI18n();
  const navigate = useNavigate();
  const [internalSelectedTab, setInternalSelectedTab] = useState('overview');
  const selectedTab = controlledSelectedTab ?? internalSelectedTab;
  const handleSelectedTabChange = (tab: string): void => {
    setInternalSelectedTab(tab);
    onSelectedTabChange?.(tab);
  };
  const {
    board,
    brick,
    isBrickLoading,
    brickInstance,
    isCustomBrick,
    readme,
    apiDocs,
    examples,
    models,
    readOnly,
    hideEdgeImpulse,
    isExample,
    diskUsageWarning,
    configureDialogProps,
    trainNewModelDialogProps,
    isEdgeImpulseConnected,
    onTrainNewModelClick,
    downloadEIModel,
    downloadGenericModel,
    getDownloadInfo,
    removeModel,
    openModelPage,
    openExternalLink,
    updateModelInUse,
    isModelUninstalling,
    isModelInstalledInApp,
  } = brickDetailLogic(brickId);

  // Auto-select default model when no model is pre-selected and models are available
  useEffect(() => {
    if (readOnly || preSelectedModelId || !preSelectedModelChange) {
      return;
    }
    // Edge Impulse projects can match bricks that don't take a model at all;
    // only bricks with compatible models should get a default selection
    if ((brick?.compatible_models ?? []).length === 0) {
      return;
    }

    // Use same logic as AiModel component for default selection
    let defaultModelId: string | undefined;

    // Look for first model with an installed impulse
    for (const model of models ?? []) {
      if (model.edgeImpulseProps?.impulses) {
        const installedImpulse = model.edgeImpulseProps.impulses.find(
          (i) => i.isInstalled,
        );
        if (installedImpulse?.installedModelId) {
          defaultModelId = installedImpulse.installedModelId;
          break;
        }
      }
    }

    // If no installed impulse, fall back to a built-in model only: remote
    // Edge Impulse entries carry the EI project id, which is not a model id
    if (!defaultModelId) {
      defaultModelId = models?.find((model) => model.isBuiltIn)?.id;
    }

    if (defaultModelId) {
      preSelectedModelChange(defaultModelId);
    }
  }, [brick, models, preSelectedModelId, preSelectedModelChange, readOnly]);

  if (isBrickLoading) {
    return (
      <div className={styles['container']}>
        <div className={styles['loader']}>
          <ArduinoLoader />
        </div>
      </div>
    );
  }

  return (
    <div className={styles['container']}>
      {configureDialogProps && brick && (
        <ConfigureAppBrickDialog
          brickId={brick?.id}
          isCustomBrick={isCustomBrick}
          {...configureDialogProps}
        />
      )}

      <div className={styles['header']}>
        <BrickIcon category={brick?.category} size="small" />
        <XSmall bold className={styles['title']}>
          {brick?.name}
        </XSmall>
        {(brick?.compatible_models ?? []).length !== 0 && <AiBadge />}
        <div className={styles['spacer']} />
        {configureDialogProps && (brick?.config_variables || []).length > 0 && (
          <Button
            onClick={(): void => configureDialogProps.setOpen(true)}
            Icon={BrickSettingsIcon}
            size={ButtonSize.Small}
            variant={ButtonVariant.Secondary}
          >
            {formatMessage(messages.configureButton)}
          </Button>
        )}
      </div>
      <Tabs
        selectedKey={selectedTab}
        defaultSelectedKey="overview"
        onSelectionChange={(tab: Key): void =>
          handleSelectedTabChange(tab as string)
        }
        keyboardActivation="manual"
        classes={{
          tabs: styles['tabs'],
          tabList: styles['tab-list'],
          tab: styles['tab'],
          tabText: styles['tab-text'],
          tabSelected: styles['tab-selected'],
          tabPanel: styles['tab-panel'],
        }}
      >
        {tabs
          .filter(
            (tab) =>
              (tab.id !== 'aiModels' ||
                (brick?.compatible_models ?? []).length !== 0) &&
              (tab.id !== 'documentation' ||
                (brick?.api_docs_path ?? '').trim() !== '') &&
              (tab.id !== 'examples' ||
                (brick?.code_examples ?? []).length !== 0),
          )
          .map((item) => (
            <Item key={item.id} title={formatMessage(item.label)}>
              <div className={styles['tab-item-container']}>
                {item.id === 'examples' && examples ? (
                  examples.map(({ content, path }) => (
                    <MarkdownReader
                      key={path}
                      content={content}
                      onOpenExternalLink={openExternalLink}
                    />
                  ))
                ) : item.id !== 'aiModels' ? (
                  <MarkdownReader
                    content={
                      (item.id === 'overview' ? readme : apiDocs) ??
                      formatMessage(messages.fileNotFound)
                    }
                    onOpenExternalLink={openExternalLink}
                    allowElement={(el, index): boolean =>
                      index !== 0 || el.tagName !== 'h1'
                    }
                  />
                ) : (
                  <div className={styles['ai-models-container']}>
                    {!hideEdgeImpulse && isEdgeImpulseConnected && (
                      <div className={styles['ai-models-info']}>
                        <InfoIconOutline />
                        <p>
                          {formatMessage(messages.missingModel, {
                            boardModel: board?.type.toUpperCase(),
                            bold: (text: string) => <b>{text}</b>,
                          })}
                        </p>
                      </div>
                    )}
                    {(models || [])?.map((model) => (
                      <AiModel
                        key={model.id}
                        inUseModelId={brickInstance?.model}
                        selectedModelId={preSelectedModelId}
                        model={model}
                        readOnly={readOnly}
                        isExample={isExample}
                        diskUsageWarning={diskUsageWarning(model.id)}
                        downloadEIModel={downloadEIModel}
                        downloadGenericModel={downloadGenericModel}
                        modelDownloadInfo={
                          model.edgeImpulseProps?.projectId
                            ? getDownloadInfo(model.edgeImpulseProps.projectId)
                            : getDownloadInfo(model.id)
                        }
                        removeModel={removeModel}
                        openModelPage={openModelPage}
                        isInstalledInApp={isModelInstalledInApp?.(model)}
                        onModelSelect={
                          readOnly
                            ? undefined
                            : preSelectedModelChange || updateModelInUse
                        }
                        isUninstalling={isModelUninstalling}
                      />
                    ))}

                    {!hideEdgeImpulse && !isExample ? (
                      <div className={styles['new-models']}>
                        <div className={styles['new-models-icon']}>
                          <EdgeImpulseIcon />
                        </div>
                        <div className={styles['new-models-text']}>
                          <XSmall bold>
                            {formatMessage(messages.trainNewModel)}
                          </XSmall>
                          <XXSmall>
                            {formatMessage(messages.trainNewModelDescription)}
                          </XXSmall>
                        </div>
                        <Button
                          variant={ButtonVariant.Secondary}
                          appearance={ButtonAppearance.LowContrast}
                          size={ButtonSize.XSmall}
                          onClick={onTrainNewModelClick}
                          Icon={OpenInNewTab}
                          classes={{
                            button: styles['new-model-button'],
                          }}
                        >
                          {formatMessage(messages.trainNewModel)}
                        </Button>
                        {trainNewModelDialogProps && (
                          <TrainNewModelDialog {...trainNewModelDialogProps} />
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
                {item.id === 'overview' &&
                  brick?.used_by_apps &&
                  brick.used_by_apps.length > 0 && (
                    <div className={styles['brick-usages']}>
                      <XSmall className={styles['brick-usages-title']}>
                        {formatMessage(messages.usedInTitle)}
                      </XSmall>
                      <div className={styles['brick-usages-cards']}>
                        {brick.used_by_apps.map((usage) => (
                          <button
                            key={usage.id}
                            type="button"
                            className={styles['brick-usage-card']}
                            onClick={async (): Promise<void> => {
                              if (usage.id) {
                                await navigate({
                                  to: getUsedByAppPath(usage.id),
                                });
                              }
                            }}
                          >
                            <div className={styles['brick-usage-header']}>
                              <div
                                className={styles['brick-usage-header-bg']}
                                style={{
                                  backgroundImage: getBackgroundIcon(
                                    usage.icon || DEFAULT_ICON,
                                  ),
                                }}
                              ></div>
                              <span
                                className={styles['brick-usage-header-icon']}
                              >
                                <EmojiPreview
                                  size={16}
                                  value={usage.icon || DEFAULT_ICON}
                                />
                              </span>
                            </div>
                            <div className={styles['brick-usage-content']}>
                              {usage.name}
                            </div>
                            <UsedByAppLinkIcon
                              className={styles['brick-usage-link-icon']}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </Item>
          ))}
      </Tabs>
    </div>
  );
};

export default BrickDetail;
