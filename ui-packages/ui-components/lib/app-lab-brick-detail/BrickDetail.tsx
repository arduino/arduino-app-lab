import { BrickSettings as BrickSettingsIcon } from '@cloud-editor-mono/images/assets/icons';
import { BrickDetails, BrickInstance } from '@cloud-editor-mono/infrastructure';
import { useEffect, useState } from 'react';
import { Item } from 'react-stately';

import BrickIcon from '../app-lab-brick-icon/BrickIcon';
import { EmojiPreview } from '../app-lab-emoji-picker/sub-components/EmojiPreview';
import MarkdownReader from '../app-lab-markdown-reader/MarkdownReader';
import {
  Button,
  ButtonSize,
  ButtonType,
  getBackgroundIcon,
  useI18n,
} from '../components-by-app/app-lab';
import {
  ConfigureAppBrickDialog,
  ConfigureAppBrickDialogLogic,
} from '../dialogs/app-lab/configure-app-brick-dialog/ConfigureAppBrickDialog';
import { Tabs } from '../essential/tab-list/Tabs';
import { Medium, XSmall } from '../typography';
import styles from './brick-detail.module.scss';
import { BrickDetailLogic } from './BrickDetail.type';
import { messages } from './messages';
import { AppLabAiBadge } from './sub-components/ai-badge/AiBadge';
import { AppLabAiModel } from './sub-components/ai-model/AiModel';

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
}

interface BrickExample {
  content: string;
  path: string;
}

const BrickDetail: React.FC<BrickDetailProps> = ({
  brickId,
  brickDetailLogic,
}: BrickDetailProps) => {
  const [brick, setBrick] = useState<BrickDetails>();
  const [instance, setInstance] = useState<BrickInstance>();
  const [apiDocs, setApiDocs] = useState<string | null>(null);
  const [examples, setExamples] = useState<BrickExample[] | null>(null);
  const [configureOpen, setConfigureOpen] = useState(false);
  const { formatMessage } = useI18n();
  const {
    initialTab,
    showConfigure,
    loadBrickInstance,
    loadBrickDetails,
    loadFileContent,
    onOpenExternalLink,
    updateBrickDetails,
  } = brickDetailLogic();
  const [selectedTab, setSelectedTab] = useState(initialTab || 'overview');

  useEffect(() => {
    const loadDetails = async (): Promise<void> => {
      try {
        const details = await loadBrickDetails(brickId);
        setBrick(details);
        if (loadBrickInstance) {
          try {
            const instanceData = await loadBrickInstance(brickId);
            setInstance(instanceData);
          } catch {
            setInstance(undefined);
          }
        }
      } catch {
        setBrick(undefined);
      }
    };
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brickId, loadBrickInstance]);

  useEffect(() => {
    setSelectedTab(initialTab || 'overview');
  }, [brickId, initialTab]);

  useEffect(() => {
    const loadContent = async (): Promise<void> => {
      if (brick?.api_docs_path) {
        try {
          const apiDocsContent = await loadFileContent(brick.api_docs_path);
          setApiDocs(apiDocsContent);
        } catch {
          setApiDocs(null);
        }
      } else {
        setApiDocs(null);
      }

      if (brick?.code_examples) {
        try {
          const examplesContent = await Promise.all(
            brick.code_examples
              .filter((example) => example.path)
              .map(async (example) => ({
                content:
                  '```python\n' +
                  (await loadFileContent(example.path!)) +
                  '\n```',
                path: example.path!,
              })),
          );
          setExamples(examplesContent);
        } catch {
          setExamples(null);
        }
      } else {
        setExamples(null);
      }
    };
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brick?.api_docs_path, brick?.code_examples]);

  const readme = brick?.readme?.trim().length ? brick.readme : null;

  const configureLogic: ConfigureAppBrickDialogLogic | null =
    showConfigure &&
    brick &&
    ((brick.compatible_models ?? []).length > 0 ||
      (brick.config_variables ?? []).length > 0) &&
    loadBrickInstance &&
    updateBrickDetails
      ? (): ReturnType<ConfigureAppBrickDialogLogic> => ({
          brick,
          open: configureOpen,
          loadBrickInstance,
          onOpenChange: setConfigureOpen,
          confirmAction: updateBrickDetails,
        })
      : null;

  const openConfigureDialog = (): void => {
    setConfigureOpen(true);
  };

  return (
    <div className={styles['container']}>
      {configureLogic && <ConfigureAppBrickDialog logic={configureLogic} />}
      <div className={styles['header']}>
        <BrickIcon category={brick?.category} />
        <Medium className={styles['title']}>{brick?.name}</Medium>
        {(brick?.compatible_models ?? []).length !== 0 && <AppLabAiBadge />}
        <div className={styles['spacer']} />
        {configureLogic && (
          <Button
            onClick={openConfigureDialog}
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
        onSelectionChange={(tab): void => setSelectedTab(tab as string)}
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
                      onOpenExternalLink={onOpenExternalLink}
                    />
                  ))
                ) : item.id !== 'aiModels' ? (
                  <MarkdownReader
                    content={
                      (item.id === 'overview' ? readme : apiDocs) ??
                      formatMessage(messages.fileNotFound)
                    }
                    onOpenExternalLink={onOpenExternalLink}
                    allowElement={(el, index): boolean =>
                      index !== 0 || el.tagName !== 'h1'
                    }
                  />
                ) : (
                  <div className={styles['ai-models-container']}>
                    {configureLogic && (
                      <XSmall className={styles['ai-models-info']}>
                        {formatMessage(messages.aiModelsInfo, {
                          link: (msg: string) => (
                            <span
                              role="button"
                              tabIndex={0}
                              className={styles['link']}
                              onClick={openConfigureDialog}
                              onKeyUp={openConfigureDialog}
                            >
                              {msg}
                            </span>
                          ),
                        })}
                      </XSmall>
                    )}
                    {brick?.compatible_models?.map((model) => (
                      <AppLabAiModel
                        key={model.id}
                        inUseModelId={instance?.model}
                        model={model}
                      />
                    ))}
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
