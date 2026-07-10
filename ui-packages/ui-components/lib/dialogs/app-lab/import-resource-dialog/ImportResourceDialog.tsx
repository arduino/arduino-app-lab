import {
  FileGeneric,
  TriangleSharp,
  UploadLight as Upload,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Button,
  ButtonSize,
  ButtonVariant,
  useI18n,
} from '../../../components-by-app/app-lab';
import { ErrorBanner } from '../../../error-banner/ErrorBanner';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { importResourceDialogMessages as messages } from '../messages';
import styles from './import-resource-dialog.module.scss';
import {
  ImportResourceDialogProps,
  ImportStatus,
} from './ImportResourceDialog.type';

export { ImportStatus } from './ImportResourceDialog.type';

export const ImportResourceDialog: React.FC<ImportResourceDialogProps> = ({
  logic,
}: ImportResourceDialogProps) => {
  const { formatMessage } = useI18n();

  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    open,
    status = ImportStatus.UploadFailed,
    errorMessage,
    onOpenChange,
    startImport,
    type,
  } = logic();

  const dialogMessages = useMemo(() => {
    if (type === 'app') {
      return {
        dialogTitle: messages.titleApp,
        bodyTitle: messages.uploadTitleApp,
        bodyDescription: messages.uploadDescriptionApp,
        bodyLabel: messages.supportZip,
        uploadLabel: messages.uploadingFile,
        uploadFailed: messages.uploadFailedApp,
        uploadFailedDescription: messages.uploadFailedDescriptionApp,
        footerButton: messages.goToMyApp,
        dragDrop: messages.dragDropApp,
      };
    } else if (type === 'folder') {
      return {
        dialogTitle: messages.titleFolder,
        bodyTitle: messages.uploadTitleFolder,
        bodyDescription: messages.uploadDescriptionFolder,
        bodyLabel: messages.supportAnyFolder,
        uploadLabel: messages.uploadingFolder,
        uploadFailed: messages.uploadFailedFolder,
        uploadFailedDescription: messages.uploadFailedDescriptionFolder,
        footerButton: messages.retry,
        dragDrop: messages.dragDropFolder,
      };
    }

    return {
      dialogTitle: messages.titleFile,
      bodyTitle: messages.uploadTitleFile,
      bodyDescription: messages.uploadDescriptionFile,
      bodyLabel: messages.supportAnyFile,
      uploadLabel: messages.uploadingFile,
      uploadFailed: messages.uploadFailedFile,
      uploadFailedDescription: messages.uploadFailedDescriptionFile,
      footerButton: messages.retry,
      dragDrop: messages.dragDropFile,
    };
  }, [type]);

  const title = useMemo(() => {
    return formatMessage(dialogMessages.dialogTitle);
  }, [dialogMessages.dialogTitle, formatMessage]);

  const footer = useMemo((): React.ReactNode => {
    if (status === ImportStatus.UploadFailed) {
      return (
        <Button
          variant={ButtonVariant.Primary}
          size={ButtonSize.Small}
          onClick={(): void =>
            onOpenChange((type === 'file' || type === 'folder') ?? false)
          }
        >
          {formatMessage(dialogMessages.footerButton)}
        </Button>
      );
    }

    return null;
  }, [status, formatMessage, dialogMessages, onOpenChange, type]);

  useEffect(() => {
    if (!open || status !== ImportStatus.Idle) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  }, [open, status]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current += 1;

    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current -= 1;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
  }, []);

  const handleButtonClick = useCallback(() => {
    startImport();
  }, [startImport]);

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      closeable={type !== 'app' || status !== ImportStatus.Uploading}
      footer={footer}
      contentProps={{
        ...(status === ImportStatus.Uploading
          ? {
              onEscapeKeyDown: (e): void => e.preventDefault(),
              onPointerDownOutside: (e): void => e.preventDefault(),
              onInteractOutside: (e): void => e.preventDefault(),
            }
          : null),
      }}
      classes={{ body: styles['dialog-body'] }}
    >
      <div className={styles['import-dialog']}>
        {status === ImportStatus.Idle && (
          <div className={styles['dialog-header']}>
            <h2 className={styles['dialog-title']}>
              {formatMessage(dialogMessages.bodyTitle)}
            </h2>
            <div className={styles['dialog-description']}>
              <p>{formatMessage(dialogMessages.bodyDescription)}</p>
            </div>
          </div>
        )}

        <input ref={fileInputRef} style={{ display: 'none' }} />

        <div
          className={clsx(styles['upload-area'], {
            [styles['upload-area--dragging']]: isDragging,
            [styles['upload-area--status-uploading']]:
              status !== ImportStatus.Idle,
          })}
          data-native-dropzone={open ? true : undefined}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div
            className={clsx(styles['upload-content'], {
              [styles['is-dragging']]: isDragging,
            })}
          >
            <div className={styles['upload-icon-wrapper']}>
              <Upload className={styles['upload-icon']} />
            </div>
            <p className={styles['upload-text']}>
              {formatMessage(dialogMessages.dragDrop)}
            </p>
            <span className={styles['upload-or']}>
              {formatMessage(messages.or)}
            </span>
            <Button
              variant={ButtonVariant.Secondary}
              size={ButtonSize.Small}
              onClick={handleButtonClick}
              Icon={Upload}
              iconPosition="right"
              classes={{ button: styles['white-icon-button'] }}
            >
              {formatMessage(messages.importFromComputer)}
            </Button>
            <span className={styles['upload-support']}>
              {formatMessage(dialogMessages.bodyLabel)}
            </span>
          </div>
          {isDragging ? (
            <div className={styles['upload-content-overlay']}>
              <div className={styles['upload-icon-wrapper']}>
                <FileGeneric className={styles['upload-icon']} />
              </div>
              <p className={styles['upload-text']}>
                {formatMessage(dialogMessages.dragDrop)}
              </p>
            </div>
          ) : null}
        </div>

        <div
          className={clsx(styles['loading-state'], {
            [styles['is-not-uploading']]: status !== ImportStatus.Uploading,
          })}
        >
          <div className={styles['spinner']} />
          <h3>{formatMessage(dialogMessages.uploadLabel)}</h3>
          <p>{formatMessage(messages.processTakesTime)}</p>
        </div>
        {status === ImportStatus.UploadFailed && (
          <div className={styles['upload-failed']}>
            <div className={styles['upload-failed--icon']}>
              <TriangleSharp />
            </div>
            <h3>{formatMessage(dialogMessages.uploadFailed)}</h3>
            <span className={styles['upload-failed--description']}>
              {formatMessage(dialogMessages.uploadFailedDescription)}
            </span>
            {errorMessage && <ErrorBanner message={errorMessage} />}
          </div>
        )}
      </div>
    </AppLabDialog>
  );
};
