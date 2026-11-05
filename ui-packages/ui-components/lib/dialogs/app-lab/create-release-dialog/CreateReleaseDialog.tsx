import { InfoIconOutline } from '@cloud-editor-mono/images/assets/icons';
import { AppInfo } from '@cloud-editor-mono/infrastructure';
import { Key, useEffect, useState } from 'react';

import {
  ReleaseNoteField,
  ReleaseSummary,
} from '../../../components-by-app/app-lab/app-release';
import { appReleaseMessages } from '../../../components-by-app/app-lab/app-release/messages';
import {
  Button,
  ButtonVariant,
} from '../../../components-by-app/app-lab/essential/button';
import { Select } from '../../../components-by-app/app-lab/essential/select';
import { Toggle } from '../../../components-by-app/app-lab/essential/toggle';
import { useTooltip } from '../../../components-by-app/app-lab/essential/tooltip';
import { Input, InputStyle } from '../../../essential/input';
import { useI18n } from '../../../i18n/useI18n';
import { XXSmall } from '../../../typography';
import { formatReleaseDate } from '../../../utils';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import {
  createReleaseDialogMessages as messages,
  exportAppDialogMessages,
} from '../messages';
import styles from './create-release-dialog.module.scss';

// A board the daemon can build for.
export interface ReleaseTarget {
  id: string;
  label: string;
}

// `createdAt` also names the release in the notifications and the saved file.
export interface ReleaseDraft {
  createdAt: string;
  label?: string;
  target: string;
  note?: string;
  includeData: boolean;
}

export type CreateReleaseDialogLogic = () => {
  open: boolean;
  app?: AppInfo;
  targets: ReleaseTarget[];
  defaultTarget: string;
  appIsRunning: boolean;
  // Resolves once the dialog may close.
  confirmAction: (draft: ReleaseDraft) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
};

type CreateReleaseDialogProps = { logic: CreateReleaseDialogLogic };

const MAX_LABEL_LENGTH = 40;

export const CreateReleaseDialog: React.FC<CreateReleaseDialogProps> = ({
  logic,
}: CreateReleaseDialogProps) => {
  const {
    open,
    app,
    targets,
    defaultTarget,
    appIsRunning,
    confirmAction,
    onOpenChange,
  } = logic();
  const { formatMessage } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAt, setCreatedAt] = useState('');
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState(defaultTarget);
  const [note, setNote] = useState('');
  const [includeData, setIncludeData] = useState(false);
  // A running App cannot ship its data folder, whatever the toggle says.
  const effectiveIncludeData = includeData && !appIsRunning;

  // Stamped on every open, so a release is not dated with an earlier opening.
  useEffect(() => {
    if (!open) return;
    setCreatedAt(formatReleaseDate(new Date()));
    setLabel('');
    setTarget(defaultTarget);
    setNote('');
    setIncludeData(false);
  }, [open, defaultTarget]);

  const labelTooltip = useTooltip({
    content: formatMessage(messages.labelInfo),
    direction: 'up-right',
    variant: 'card',
  });
  const includeDataTooltip = useTooltip({
    content: formatMessage(
      appIsRunning
        ? messages.includeDataInfoRunning
        : exportAppDialogMessages.includeDataTooltipContent,
    ),
    title: formatMessage(exportAppDialogMessages.includeDataTooltipTitle),
    direction: 'up-right',
    variant: 'card',
  });

  const canSubmit = target.length > 0 && !isSubmitting;
  const includeDataLabel = formatMessage(
    exportAppDialogMessages.includeDataLabel,
  );
  const selectedTarget = targets.find(({ id }) => id === target);

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const started = await confirmAction({
        createdAt,
        label: label.trim() || undefined,
        target,
        note: note.trim() || undefined,
        includeData: effectiveIncludeData,
      });
      if (started) onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      // The build copies the App while this is open; closing it mid-copy ships a broken release.
      closeable={!isSubmitting}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={handleSubmit}
      classes={{ content: styles['content'], body: styles['body'] }}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            disabled={isSubmitting}
            onClick={(): void => onOpenChange(false)}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            loading={isSubmitting}
            disabled={!canSubmit}
            type="submit"
          >
            {formatMessage(
              isSubmitting ? messages.buildingButton : messages.confirmButton,
            )}
          </Button>
        </>
      }
    >
      {/* A fieldset disables every field inside for pointer and keyboard at once. */}
      <fieldset className={styles['form']} disabled={isSubmitting}>
        <ReleaseSummary
          className={styles['header']}
          release={{ name: app?.name ?? '', icon: app?.icon, createdAt }}
        />
        <div className={styles['row']}>
          <label className={styles['row-label']} htmlFor="release-label">
            <XXSmall>
              {formatMessage(appReleaseMessages.labelLabel)}{' '}
              <span className={styles['row-optional']}>
                {formatMessage(messages.optional)}
              </span>
            </XXSmall>
          </label>
          <div className={styles['row-control']}>
            <Input
              inputStyle={InputStyle.AppLab}
              id="release-label"
              type="text"
              value={label}
              onChange={(value: string): void => {
                if (value.length <= MAX_LABEL_LENGTH) setLabel(value);
              }}
              classes={{
                input: styles['label-input'],
                inputContainer: styles['label-input-container'],
              }}
            />
            <span {...labelTooltip.props} className={styles['info']}>
              <InfoIconOutline />
            </span>
            {labelTooltip.renderTooltip()}
          </div>
        </div>
        <div className={styles['row']}>
          <label className={styles['row-label']} htmlFor="release-target">
            <XXSmall>{formatMessage(messages.targetLabel)}</XXSmall>
          </label>
          <div className={styles['row-control']}>
            <Select
              id="release-target"
              name="release-target"
              displayValue={selectedTarget?.label ?? target}
              selectedId={target}
              sections={[{ name: 'targets', items: targets }]}
              onChange={(key: Key): void => setTarget(String(key))}
              classes={{ container: styles['target-select'] }}
            />
          </div>
        </div>
        <ReleaseNoteField
          id="release-note"
          label={formatMessage(appReleaseMessages.noteLabel)}
          optionalLabel={formatMessage(messages.optional)}
          value={note}
          onChange={setNote}
        />
        {/* Sources ship with every release, so the data folder is the only option. */}
        <div className={styles['row']}>
          <div className={styles['option-label']}>
            <XXSmall>{includeDataLabel}</XXSmall>
            <span {...includeDataTooltip.props} className={styles['info']}>
              <InfoIconOutline />
            </span>
            {includeDataTooltip.renderTooltip()}
          </div>
          <Toggle
            aria-label={includeDataLabel}
            className={styles['option-toggle']}
            isSelected={effectiveIncludeData}
            isDisabled={appIsRunning}
            onChange={setIncludeData}
          />
        </div>
      </fieldset>
    </AppLabDialog>
  );
};
