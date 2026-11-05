import { Key, useEffect, useState } from 'react';
import { MessageDescriptor } from 'react-intl';
import { Item } from 'react-stately';

import { ConfigureAppBrickDialog } from '../../../dialogs/app-lab/configure-app-brick-dialog/ConfigureAppBrickDialog';
import { ArduinoLoader } from '../../../essential/loader';
import { Tabs } from '../../../essential/tab-list/Tabs';
import { useI18n } from '../../../i18n/useI18n';
import { isEdgeImpulseModel } from '../ai-model/helpers';
import styles from './brick-detail.module.scss';
import { BrickDetailLogic, BrickDetailTabId } from './BrickDetail.type';
import { messages } from './messages';
import { BrickHeader } from './sub-components/brick-header/BrickHeader';
import { AiModelsTab } from './sub-components/tabs/ai-models-tab/AiModelsTab';
import { DocumentationTab } from './sub-components/tabs/DocumentationTab';
import { ExamplesTab } from './sub-components/tabs/examples-tab/ExamplesTab';
import { OverviewTab } from './sub-components/tabs/OverviewTab';

type BrickDetailTab = {
  id: BrickDetailTabId;
  label: MessageDescriptor;
  hasContent?: boolean;
  render: () => React.ReactNode;
};

const DEFAULT_TAB: BrickDetailTabId = 'overview';

interface BrickDetailProps {
  brickId: string;
  brickDetailLogic: BrickDetailLogic;
  preSelectedModelId?: string;
  onPreSelectedModelChange?: (id: string) => void;
  selectedTab?: BrickDetailTabId;
  onSelectedTabChange?: (tab: BrickDetailTabId) => void;
  hideExampleHeader?: boolean;
}

const BrickDetail: React.FC<BrickDetailProps> = ({
  brickId,
  brickDetailLogic,
  preSelectedModelId,
  onPreSelectedModelChange,
  selectedTab: controlledSelectedTab,
  onSelectedTabChange,
  hideExampleHeader = false,
}: BrickDetailProps) => {
  const { formatMessage } = useI18n();
  const isTabControlled = controlledSelectedTab !== undefined;
  const [internalSelectedTab, setInternalSelectedTab] =
    useState<BrickDetailTabId>(DEFAULT_TAB);
  const selectedTab = controlledSelectedTab ?? internalSelectedTab;
  const handleSelectedTabChange = (tab: BrickDetailTabId): void => {
    // Track the tab internally only while uncontrolled: writing it when the
    // parent owns the selection leaves a second source of truth.
    if (!isTabControlled) {
      setInternalSelectedTab(tab);
    }
    onSelectedTabChange?.(tab);
  };
  const logic = brickDetailLogic(brickId, onPreSelectedModelChange);
  const {
    brick,
    isBrickLoading,
    brickInstance,
    isCustomBrick,
    readme,
    apiDocs,
    examples,
    models,
    readOnly,
    trainNewModelEnabled,
    addHuggingFaceModelEnabled,
    isReadOnlyApp,
    configureDialogProps,
    trainNewModelDialogProps,
    onTrainNewModelClick,
    openExternalLink,
    updateModelInUse,
    addHuggingFaceModelDialogProps,
  } = logic;

  // Auto-select default model when no model is pre-selected and models are available
  useEffect(() => {
    if (readOnly || preSelectedModelId || !onPreSelectedModelChange) {
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
      if (isEdgeImpulseModel(model)) {
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
      onPreSelectedModelChange(defaultModelId);
    }
  }, [brick, models, preSelectedModelId, onPreSelectedModelChange, readOnly]);

  const tabs: BrickDetailTab[] = [
    {
      id: 'overview',
      label: messages.overviewTab,
      render: () => (
        <OverviewTab
          readme={readme}
          usages={brick?.used_by_apps ?? []}
          onOpenExternalLink={openExternalLink}
        />
      ),
    },
    {
      id: 'examples',
      label: messages.examplesTab,
      hasContent: (brick?.code_examples ?? []).length !== 0,
      render: () => (
        <ExamplesTab
          examples={examples}
          onOpenExternalLink={openExternalLink}
          hideHeader={hideExampleHeader}
        />
      ),
    },
    {
      id: 'documentation',
      label: messages.documentationTab,
      hasContent: (brick?.api_docs_path ?? '').trim() !== '',
      render: () => (
        <DocumentationTab
          apiDocs={apiDocs}
          onOpenExternalLink={openExternalLink}
        />
      ),
    },
    {
      id: 'aiModels',
      label: messages.aiModelsTab,
      hasContent: (brick?.compatible_models ?? []).length !== 0,
      render: () => (
        <AiModelsTab
          models={models ?? []}
          modelActions={logic}
          inUseModelId={brickInstance?.model}
          selectedModelId={preSelectedModelId}
          onModelSelect={
            readOnly ? undefined : onPreSelectedModelChange || updateModelInUse
          }
          readOnly={readOnly}
          isReadOnlyApp={isReadOnlyApp}
          trainNewModelEnabled={trainNewModelEnabled}
          addHuggingFaceModelEnabled={addHuggingFaceModelEnabled}
          addHuggingFaceModelDialogProps={addHuggingFaceModelDialogProps}
          trainNewModelDialogProps={trainNewModelDialogProps}
          onTrainNewModelClick={onTrainNewModelClick}
        />
      ),
    },
  ];

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
          brickId={brick.id}
          isCustomBrick={isCustomBrick}
          {...configureDialogProps}
        />
      )}

      <BrickHeader
        brick={brick}
        onConfigure={
          configureDialogProps &&
          ((): void => configureDialogProps.setOpen(true))
        }
      />
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key: Key): void => {
          const tab = tabs.find(({ id }) => id === key);
          if (tab) {
            handleSelectedTabChange(tab.id);
          }
        }}
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
          .filter((tab) => tab.hasContent ?? true)
          .map((tab) => (
            <Item key={tab.id} title={formatMessage(tab.label)}>
              <div className={styles['tab-item-container']}>{tab.render()}</div>
            </Item>
          ))}
      </Tabs>
    </div>
  );
};

export default BrickDetail;
