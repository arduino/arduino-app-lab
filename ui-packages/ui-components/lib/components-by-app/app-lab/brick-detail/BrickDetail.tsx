import {
  BrickSettings as BrickSettingsIcon,
  EdgeImpulse as EdgeImpulseIcon,
  InfoIconOutline,
  OpenInNewTab,
} from '@cloud-editor-mono/images/assets/icons';
import {} from '@cloud-editor-mono/images/assets/icons';
import {
  AiModel,
  Button,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  ConfigureAppBrickDialog,
  getBackgroundIcon,
  Medium,
  TrainNewModelDialog,
  useI18n,
  XSmall,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Key, useState } from 'react';
import { Item } from 'react-stately';

import { Tabs } from '../../../essential/tab-list/Tabs';
import BrickIcon from '../brick-icon/BrickIcon';
import { EmojiPreview } from '../emoji-picker/sub-components/EmojiPreview';
import MarkdownReader from '../markdown-reader/MarkdownReader';
import styles from './brick-detail.module.scss';
import { BrickDetailLogic } from './BrickDetail.type';
import { messages } from './messages';
import { AiBadge } from './sub-components/ai-badge/AiBadge';

const DEFAULT_ICON = '⚪'; // Default icon if none is provided

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
}

const BrickDetail: React.FC<BrickDetailProps> = ({
  brickId,
  brickDetailLogic,
  preSelectedModelId,
  preSelectedModelChange,
}: BrickDetailProps) => {
  const { formatMessage } = useI18n();
  const [selectedTab, setSelectedTab] = useState('overview');
  const {
    brick,
    brickInstance,
    readme,
    apiDocs,
    examples,
    models,
    readOnly,
    hideEdgeImpulse,
    diskUsageWarning,
    configureDialogProps,
    trainNewModelDialogProps,
    isEdgeImpulseConnected,
    onTrainNewModelClick,
    downloadModel,
    getDownloadInfo,
    removeModel,
    openModelPage,
    openExternalLink,
    updateModelInUse,
  } = brickDetailLogic(brickId);

  return (
    <div className={styles['container']}>
      {configureDialogProps && brick && (
        <ConfigureAppBrickDialog brick={brick} {...configureDialogProps} />
      )}
      <div className={styles['header']}>
        <BrickIcon category={brick?.category} />
        <Medium className={styles['title']}>{brick?.name}</Medium>
        {(brick?.compatible_models ?? []).length !== 0 && <AiBadge />}
        <div className={styles['spacer']} />
        {configureDialogProps && (brick?.config_variables || []).length > 0 && (
          <Button
            onClick={(): void => configureDialogProps.setOpen(true)}
            Icon={BrickSettingsIcon}
            size={ButtonSize.Small}
            type={ButtonType.Secondary}
          >
            {formatMessage(messages.configureButton)}
          </Button>
        )}
      </div>
      <Tabs
        selectedKey={selectedTab}
        defaultSelectedKey="overview"
        onSelectionChange={(tab: Key): void => setSelectedTab(tab as string)}
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
              (brick?.compatible_models ?? []).length !== 0 ||
              tab.id !== 'aiModels',
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
                          {formatMessage(messages.unoQFilter, {
                            bold: (text: string) => <b>{text}</b>,
                          })}
                        </p>
                      </div>
                    )}
                    {(models || [])?.map((model) => (
                      <AiModel
                        key={model.id}
                        inUseModelId={
                          brickInstance?.model || preSelectedModelId
                        }
                        model={model}
                        readOnly={readOnly}
                        hideEdgeImpulse={hideEdgeImpulse}
                        diskUsageWarning={diskUsageWarning}
                        downloadModel={downloadModel}
                        modelDownloadInfo={
                          model.edgeImpulseProps?.projectId
                            ? getDownloadInfo(model.edgeImpulseProps.projectId)
                            : undefined
                        }
                        removeModel={removeModel}
                        openModelPage={openModelPage}
                        onModelSelect={
                          readOnly
                            ? undefined
                            : preSelectedModelChange || updateModelInUse
                        }
                      />
                    ))}

                    {!hideEdgeImpulse && (
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
                          type={ButtonType.Secondary}
                          variant={ButtonVariant.LowContrast}
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
                    )}
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
                          <div
                            key={usage.id}
                            className={styles['brick-usage-card']}
                          >
                            <div className={styles['brick-usage-header']}>
                              <div
                                className={styles['brick-usage-header-bg']}
                                style={{
                                  background: getBackgroundIcon(
                                    usage.icon || DEFAULT_ICON,
                                  ),
                                }}
                              ></div>

                              <span
                                className={styles['brick-usage-header-icon']}
                              >
                                <EmojiPreview
                                  size={32}
                                  value={usage.icon || DEFAULT_ICON}
                                />
                              </span>
                            </div>
                            <div className={styles['brick-usage-content']}>
                              {usage.name}
                            </div>
                          </div>
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
