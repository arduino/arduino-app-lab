import {
  Bin,
  Checkmark,
  ChevronDown,
  Download,
  OpenInNewTab,
  Reload,
  ThreeDots,
  Warning,
} from '@cloud-editor-mono/images/assets/icons';
import { AIModelItem } from '@cloud-editor-mono/infrastructure';
import {
  Button,
  ButtonSize,
  ButtonType,
  DropdownMenuButton,
  DropdownMenuItemType,
  ProgressBar,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Key, useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../typography';
import { aiModelMessages, messages } from '../brick-detail/messages';
import styles from './ai-model.module.scss';
import { AiModelProps } from './AiModel.type';

export const AiModel: React.FC<AiModelProps> = (props: AiModelProps) => {
  const { formatMessage } = useI18n();
  const {
    inUseModelId,
    model,
    onModelSelect,
    downloadModel,
    removeModel,
    openModelPage,
    diskUsageWarning,
    modelDownloadInfo,
    readOnly,
    hideEdgeImpulse,
  } = props;

  const [moreInfoIsOpen, setMoreInfoIsOpen] = useState(false);

  const impulses = useMemo(
    () => model.edgeImpulseProps?.impulses || [],
    [model.edgeImpulseProps?.impulses],
  );
  const [selectedImpulseId, setSelectedImpulseId] = useState<
    string | undefined
  >();
  const selectedImpulse = impulses.find((i) => i.id === selectedImpulseId);

  const impulseInUse = useMemo(
    () => impulses.find((i) => i.installedModelId === inUseModelId),
    [impulses, inUseModelId],
  );

  useEffect(() => {
    if (!selectedImpulseId) {
      setSelectedImpulseId(
        impulseInUse?.id ||
          impulses.find((i) => i.isInstalled)?.id ||
          impulses[0]?.id,
      );
    }
  }, [
    hideEdgeImpulse,
    impulseInUse,
    impulseInUse?.id,
    impulses,
    readOnly,
    selectedImpulseId,
  ]);

  const isDownloading = modelDownloadInfo && modelDownloadInfo.isDownloading;

  const isModelInUse =
    inUseModelId && (model.id === inUseModelId || !!impulseInUse);

  const isSelectable =
    !readOnly &&
    !hideEdgeImpulse &&
    !isModelInUse &&
    (model.isBuiltIn || selectedImpulse?.isInstalled);

  const isDisabled =
    readOnly ||
    hideEdgeImpulse ||
    (!model.isBuiltIn && selectedImpulse && !selectedImpulse.isInstalled);
  const hideRadio = readOnly && !hideEdgeImpulse; // brick list view

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: hideEdgeImpulse
      ? "Models can't be changed in examples"
      : 'Download the model to enable',
    direction: 'right',
    timeout: 200,
  });
  const showTooltip =
    readOnly || (!model.isBuiltIn && !selectedImpulse?.isInstalled);

  return (
    <div
      className={clsx(styles['ai-model-card'], {
        [styles['selectable']]: !!isSelectable,
        [styles['selected']]: isModelInUse,
        [styles['disabled']]: isDisabled,
        [styles['disabled-radio-only']]: readOnly || hideEdgeImpulse,
      })}
      {...(isSelectable &&
        onModelSelect && {
          onClick: (): void =>
            onModelSelect(selectedImpulse?.installedModelId || model.id),
        })}
    >
      {!hideRadio && (
        <div className={styles['radio']} {...tooltipProps}>
          {showTooltip && renderTooltip(styles['radio-tooltip'])}
        </div>
      )}
      <div className={styles['ai-model-card-container']}>
        <div className={styles['ai-model-card-header']}>
          <XSmall className={styles['ai-model-name']}>{model.name}</XSmall>
          {isModelInUse && (
            <div className={styles['ai-model-in-use']}>
              {formatMessage(messages.aiModelInUse)}
            </div>
          )}
          {isModelInUse && !!impulseInUse && (
            <div className={styles['ai-impulse-in-use']}>
              {impulseInUse.name}
            </div>
          )}
          {model.edgeImpulseProps && (
            <DropdownMenuButton
              title={'Model options'}
              sections={[
                {
                  name: 'Actions',
                  items: [
                    {
                      id: 'edit-model',
                      label: 'Edit model',
                      labelPrefix: <OpenInNewTab />,
                    } as DropdownMenuItemType<string, string>,
                  ].concat(
                    selectedImpulse?.isInstalled
                      ? [
                          {
                            id: 'remove-model',
                            label: 'Uninstall',
                            labelPrefix: <Bin />,
                            itemClassName: styles['remove-model'],
                          },
                        ]
                      : [],
                  ),
                },
              ]}
              buttonChildren={<ThreeDots />}
              onAction={(key): void => {
                key === 'edit-model'
                  ? openModelPage?.(model.id, selectedImpulse?.id)
                  : removeModel?.(selectedImpulse?.installedModelId ?? '');
              }}
              classes={{
                dropdownMenuButtonWrapper:
                  styles['dropdown-menu-button-wrapper'],
                dropdownMenuButton: styles['dropdown-menu-button'],
                dropdownMenu: styles['dropdown-menu'],
                dropdownMenuItem: styles['dropdown-menu-item'],
              }}
            />
          )}
        </div>
        <XXSmall className={styles['ai-model-description']}>
          {model.description}
        </XXSmall>
        <details
          onToggle={async (e): Promise<void> => {
            setMoreInfoIsOpen(e.currentTarget.open);
          }}
          className={clsx(styles['more-info'], {
            [styles['is-open']]: moreInfoIsOpen,
          })}
        >
          <summary
            className={styles['more-info-summary']}
            onClick={(e): void => e.stopPropagation()}
          >
            {moreInfoIsOpen
              ? formatMessage(aiModelMessages.lessInfo)
              : formatMessage(aiModelMessages.moreInfo)}
          </summary>
          <ul className={styles['more-info-list']}>
            <Button
              size={ButtonSize.XXSmall}
              type={ButtonType.Tertiary}
              onClick={(e): void => {
                e.stopPropagation();
                if (model.edgeImpulseProps) {
                  openModelPage?.(
                    model.edgeImpulseProps.projectId,
                    selectedImpulse?.id,
                  );
                } else {
                  openModelPage?.(model.id);
                }
              }}
              classes={{
                button: styles['button'],
              }}
            >
              {formatMessage(aiModelMessages.modelCard)}
            </Button>
            <XXSmall>
              {formatMessage(aiModelMessages.source, {
                source:
                  (model as AIModelItem)?.metadata?.['source'] ?? 'edgeimpulse',
              })}
            </XXSmall>
            <XXSmall>
              {formatMessage(aiModelMessages.eiProjectID, {
                id:
                  (model as AIModelItem)?.metadata?.['ei-project-id'] ??
                  model.id,
              })}
            </XXSmall>
          </ul>
        </details>
        {model.edgeImpulseProps && (
          <div className={styles['ai-model-impulse']}>
            {!isDownloading && (
              <>
                {diskUsageWarning && (
                  <div className={styles['disk-warning']}>
                    <Warning />
                    Used: {diskUsageWarning.used} GB of {diskUsageWarning.total}{' '}
                    GB
                  </div>
                )}
                {impulses.length > 1 && (
                  <DropdownMenuButton
                    sections={[
                      {
                        name: 'Select Impulse',
                        items: impulses.map((impulse) => ({
                          id: impulse.id,
                          label: impulse.name,
                          node: (
                            <>
                              <div className={styles['impulse-item-name']}>
                                {impulse.name}
                              </div>
                              {selectedImpulse &&
                                selectedImpulse.id === impulse.id && (
                                  <Checkmark />
                                )}
                            </>
                          ),
                        })),
                      },
                    ]}
                    classes={{
                      dropdownMenuButtonWrapper:
                        styles['dropdown-menu-button-wrapper'],
                      dropdownMenuButton: styles['dropdown-menu-button'],
                      dropdownMenu: styles['dropdown-menu'],
                      dropdownMenuItem: styles['dropdown-menu-item'],
                    }}
                    onAction={(key: Key): void => {
                      setSelectedImpulseId(key as string);
                      if (isModelInUse) {
                        const impulse = impulses.find((i) => i.id === key);
                        if (
                          impulse &&
                          impulse.installedModelId &&
                          impulse.installedModelId !== inUseModelId
                        ) {
                          onModelSelect?.(impulse.installedModelId);
                        }
                      }
                    }}
                    buttonChildren={
                      <div className={styles['impulse-select']}>
                        <div className={styles['impulse-select-name']}>
                          {selectedImpulse?.name}
                        </div>
                        {selectedImpulse?.isInstalled && (
                          <span className={styles['impulse-select-installed']}>
                            <Checkmark /> Installed
                          </span>
                        )}
                        <ChevronDown />
                      </div>
                    }
                  ></DropdownMenuButton>
                )}
                {impulses.length === 1 &&
                selectedImpulse?.isInstalled &&
                !selectedImpulse.isOutdated ? (
                  <span className={styles['ai-model-impulse-installed']}>
                    <Checkmark /> Installed
                  </span>
                ) : (
                  <Button
                    type={ButtonType.Primary}
                    size={ButtonSize.XSmall}
                    title={
                      selectedImpulse?.isOutdated
                        ? 'Update model'
                        : 'Download model'
                    }
                    onClick={(e): void => {
                      e.stopPropagation();
                      model.id &&
                        selectedImpulse &&
                        model.edgeImpulseProps &&
                        downloadModel &&
                        downloadModel(
                          model.edgeImpulseProps.projectId,
                          selectedImpulse.id,
                        );
                    }}
                    classes={{
                      button: clsx(
                        styles['download-button'],
                        !(impulses.length > 1) &&
                          styles['download-button-text'],
                      ),
                    }}
                    disabled={
                      !selectedImpulse ||
                      (selectedImpulse.isInstalled &&
                        !selectedImpulse.isOutdated)
                    }
                  >
                    {impulses.length > 1
                      ? ''
                      : selectedImpulse?.isOutdated
                      ? 'Update'
                      : 'Download'}{' '}
                    {selectedImpulse?.isOutdated ? <Reload /> : <Download />}
                  </Button>
                )}
              </>
            )}
            {isDownloading && (
              <div className={styles['impulse-download-progress']}>
                <XXSmall>Installing model...</XXSmall>
                <ProgressBar
                  classes={{ progressBar: styles['progress-bar'] }}
                  active={true}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
