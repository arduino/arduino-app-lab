import {
  Checkmark,
  ChevronDown,
  Download,
  Reload,
  Warning,
} from '@cloud-editor-mono/images/assets/icons';
import {
  BrickDetailModelImpulse,
  Button,
  ButtonSize,
  ButtonVariant,
  DropdownMenuButton,
  ProgressBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Key } from 'react';

import { XXSmall } from '../../../../../typography';
import styles from '../../ai-model.module.scss';
import { AiModelProps } from '../../AiModel.type';

export interface AiModelEdgeImpulseActionsProps {
  model: AiModelProps['model'];
  impulses: BrickDetailModelImpulse[];
  selectedImpulse?: BrickDetailModelImpulse;
  inUseModelId?: string;
  isModelInUse: boolean;
  isDownloading?: boolean;
  diskUsageWarning?: AiModelProps['diskUsageWarning'];
  setSelectedImpulseId: (impulseId: string | undefined) => void;
  onModelSelect?: AiModelProps['onModelSelect'];
  downloadEIModel?: AiModelProps['downloadEIModel'];
}

/** Impulse selection + download/update + install progress for EI models. */
export const AiModelEdgeImpulseActions: React.FC<
  AiModelEdgeImpulseActionsProps
> = ({
  model,
  impulses,
  selectedImpulse,
  inUseModelId,
  isModelInUse,
  isDownloading,
  diskUsageWarning,
  setSelectedImpulseId,
  onModelSelect,
  downloadEIModel,
}: AiModelEdgeImpulseActionsProps) => (
  <div className={styles['ai-model-impulse']}>
    {!isDownloading && (
      <>
        <div className={styles['ai-model-impulse-download']}>
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
                          selectedImpulse.id === impulse.id && <Checkmark />}
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
            />
          )}
          {impulses.length === 1 &&
          selectedImpulse?.isInstalled &&
          !selectedImpulse.isOutdated ? (
            <span className={styles['ai-model-impulse-installed']}>
              <Checkmark /> Installed
            </span>
          ) : (
            <Button
              variant={ButtonVariant.Primary}
              size={ButtonSize.XSmall}
              title={
                selectedImpulse?.isOutdated ? 'Update model' : 'Download model'
              }
              onClick={(e): void => {
                e.stopPropagation();
                model.id &&
                  selectedImpulse &&
                  model.edgeImpulseProps &&
                  downloadEIModel &&
                  downloadEIModel(
                    model.edgeImpulseProps.projectId,
                    selectedImpulse.id,
                  );
              }}
              classes={{
                button: clsx(
                  styles['download-button'],
                  !(impulses.length > 1) && styles['download-button-text'],
                ),
              }}
              disabled={
                !selectedImpulse ||
                (selectedImpulse.isInstalled && !selectedImpulse.isOutdated)
              }
            >
              {impulses.length > 1
                ? ''
                : selectedImpulse?.isOutdated
                ? 'Update'
                : 'Download'}
              {selectedImpulse?.isOutdated ? <Reload /> : <Download />}
            </Button>
          )}
        </div>
        {diskUsageWarning && (
          <div className={styles['disk-warning']}>
            <Warning />
            Used: {diskUsageWarning.used} GB of {diskUsageWarning.total} GB
          </div>
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
);
