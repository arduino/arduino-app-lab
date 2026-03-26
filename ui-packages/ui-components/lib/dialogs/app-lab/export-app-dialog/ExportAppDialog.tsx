import {
  InfoIconOutline,
  TriangleSharp,
} from '@cloud-editor-mono/images/assets/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import { Button, ButtonType } from '../../../components-by-app/app-lab';
import { ErrorBanner } from '../../../error-banner/ErrorBanner';
import { Checkbox } from '../../../essential/checkbox';
import { useI18n } from '../../../i18n/useI18n';
import { useTooltip } from '../../../tooltip';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { exportAppDialogMessages as messages } from '../messages';
import styles from './export-app-dialog.module.scss';

export type ExportAppDialogLogic = () => {
  open: boolean;
  appName?: string;
  onExport: (includeData: boolean) => void;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  error: unknown;
  reset: () => void;
};

type ExportAppDialogProps = { logic: ExportAppDialogLogic };

export const ExportAppDialog: React.FC<ExportAppDialogProps> = ({
  logic,
}: ExportAppDialogProps) => {
  const { open, appName, onOpenChange, onExport, isLoading, error, reset } =
    logic();
  const [includeData, setIncludeData] = useState(false);

  const { formatMessage } = useI18n();

  const exportError = useMemo(() => {
    if (!error) return null;

    if (typeof error === 'string') {
      return error;
    } else if (error instanceof Error) {
      return error.message;
    } else if (error && typeof error === 'object') {
      const errorObj = error as { message?: string; details?: string };
      return errorObj.details || errorObj.message;
    }

    return 'Unknown error occurred';
  }, [error]);

  useEffect(() => {
    if (!open) {
      setIncludeData(false);
      reset();
    }
  }, [open, reset]);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.includeDataTooltipContent),
    title: formatMessage(messages.includeDataTooltipTitle),
    direction: 'up-right',
  });

  const handleClose = useCallback((): void => {
    onOpenChange(false);
    setIncludeData(false);
  }, [onOpenChange]);

  const footer = useMemo(() => {
    if (exportError) {
      return (
        <Button type={ButtonType.Primary} onClick={handleClose}>
          {formatMessage(messages.goBackButton)}
        </Button>
      );
    }

    return (
      <>
        <Button
          type={ButtonType.Secondary}
          onClick={handleClose}
          classes={{
            button: styles['action-button'],
          }}
        >
          {formatMessage(messages.cancelButton)}
        </Button>
        <Button 
          type={ButtonType.Primary} 
          loading={isLoading} 
          isSubmit
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus
        >
          {formatMessage(messages.confirmButton)}
        </Button>
      </>
    );
  }, [exportError, handleClose, formatMessage, isLoading]);

  return (
    <AppLabDialog
      open={open}
      onOpenChange={handleClose}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={(): void => onExport(includeData)}
      footer={footer}
      classes={{
        body: styles['body'],
      }}
    >
      {exportError ? (
        <div className={styles['export-failed']}>
          <div className={styles['export-failed--icon']}>
            <TriangleSharp />
          </div>
          <h3>{formatMessage(messages.exportFailed)}</h3>
          <span className={styles['export-failed--description']}>
            {formatMessage(messages.exportFailedDescription)}
          </span>
          {exportError && <ErrorBanner message={exportError} />}
        </div>
      ) : (
        <>
          <h2 className={styles['body-title']}>
            {formatMessage(messages.dialogBodyTitle, {
              appName,
            })}
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
        </>
      )}
    </AppLabDialog>
  );
};
