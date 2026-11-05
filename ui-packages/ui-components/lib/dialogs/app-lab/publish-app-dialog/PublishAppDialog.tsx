import {
  InfoIconOutline,
  PublishOnProjectHub,
} from '@cloud-editor-mono/images/assets/icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import {
  Button,
  ButtonVariant,
  useTooltip,
} from '../../../components-by-app/app-lab';
import { Checkbox } from '../../../essential/checkbox';
import { useI18n } from '../../../i18n/useI18n';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { publishAppDialogMessages as messages } from '../messages';
import styles from './publish-app-dialog.module.scss';

export type PublishAppDialogLogic = () => {
  open: boolean;
  onPublish: (includeData: boolean) => void;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
};

type PublishAppDialogProps = { logic: PublishAppDialogLogic };

export const PublishAppDialog: React.FC<PublishAppDialogProps> = ({
  logic,
}: PublishAppDialogProps) => {
  const { open, onOpenChange, onPublish, isLoading } = logic();
  const [includeData, setIncludeData] = useState(false);

  const { formatMessage } = useI18n();

  useEffect(() => {
    if (!open) {
      setIncludeData(false);
    }
  }, [open]);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.includeDataTooltipContent),
    title: formatMessage(messages.includeDataTooltipTitle),
    variant: 'card',
  });

  const handleClose = useCallback((): void => {
    onOpenChange(false);
    setIncludeData(false);
  }, [onOpenChange]);

  return (
    <AppLabDialog
      open={open}
      onOpenChange={handleClose}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={(): void => onPublish(includeData)}
      classes={{
        root: styles['root'],
        content: styles['content'],
        body: styles['body'],
      }}
    >
      <div className={styles['illustration']}>
        <PublishOnProjectHub />
      </div>
      <div className={styles['body-content']}>
        <h2 className={styles['body-title']}>
          {formatMessage(messages.dialogBodyTitle)}
        </h2>
        <p className={styles['body-description']}>
          <FormattedMessage
            {...messages.dialogBodyDescription}
            values={{
              strong: (chunks) => <strong>{chunks}</strong>,
            }}
          />
        </p>
        <div className={styles['checkbox-container']}>
          <Checkbox
            isSelected={includeData}
            onChange={(isSelected): void => setIncludeData(isSelected)}
            id="include-data"
          />
          <label htmlFor="include-data" className={styles['checkbox-label']}>
            {formatMessage(messages.includeDataLabel)}
          </label>
          <div
            {...tooltipProps}
            ref={tooltipProps.ref}
            className={styles['info-icon-wrapper']}
          >
            <div className={styles['info-icon']}>
              <InfoIconOutline />
            </div>
          </div>
          {renderTooltip()}
        </div>
        <div className={styles['body-actions']}>
          <Button
            variant={ButtonVariant.Primary}
            loading={isLoading}
            type="submit"
            autoFocus
          >
            {formatMessage(messages.confirmButton)}
          </Button>
        </div>
      </div>
    </AppLabDialog>
  );
};
