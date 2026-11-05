import {
  FileGeneric,
  InfoIconOutline,
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
import { ReleaseSummary } from '../../../components-by-app/app-lab/app-release';
import { Toggle } from '../../../components-by-app/app-lab/essential/toggle';
import { XXSmall } from '../../../components-by-app/shared';
import { ErrorBanner } from '../../../error-banner/ErrorBanner';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import {
  importResourceDialogMessages as messages,
  preparationRequiredDialogMessages,
} from '../messages';
import styles from './import-resource-dialog.module.scss';
import {
  ImportResourceDialogProps,
  ImportStatus,
} from './ImportResourceDialog.type';

export { ImportStatus } from './ImportResourceDialog.type';

const APP_FORMATS = ['.zip', '.ard'];

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
    pendingRelease,
    enablePreparation = true,
    setEnablePreparation,
    confirmReleaseInstall,
    cancelReleaseInstall,
  } = logic();

  const isInstalling = status === ImportStatus.Installing;
  // The release stays on screen while it installs, with the button spinning.
  const isReleaseStep = status === ImportStatus.ReleaseInfo || isInstalling;

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
    if (isReleaseStep) {
      return (
        <>
          <Button
            variant={ButtonVariant.Secondary}
            size={ButtonSize.Small}
            disabled={isInstalling}
            onClick={(): void => cancelReleaseInstall?.()}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            size={ButtonSize.Small}
            loading={isInstalling}
            onClick={(): void => confirmReleaseInstall?.()}
          >
            {formatMessage(
              isInstalling ? messages.installingButton : messages.installButton,
            )}
          </Button>
        </>
      );
    }

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
  }, [
    status,
    isReleaseStep,
    isInstalling,
    formatMessage,
    dialogMessages,
    onOpenChange,
    type,
    cancelReleaseInstall,
    confirmReleaseInstall,
  ]);

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
      closeable={
        type !== 'app' || (status !== ImportStatus.Uploading && !isInstalling)
      }
      footer={footer}
      contentProps={{
        ...(status === ImportStatus.Uploading || isInstalling
          ? {
              onEscapeKeyDown: (e): void => e.preventDefault(),
              onPointerDownOutside: (e): void => e.preventDefault(),
              onInteractOutside: (e): void => e.preventDefault(),
            }
          : null),
      }}
      classes={{
        content: styles['dialog-content'],
        body: isReleaseStep ? styles['release-body'] : styles['dialog-body'],
      }}
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

        {isReleaseStep && pendingRelease ? (
          <div className={styles['release-step']}>
            <ReleaseSummary
              className={styles['release-summary']}
              release={pendingRelease}
            />
            <div className={styles['preparation']}>
              <div className={styles['preparation-text']}>
                <XXSmall semibold className={styles['preparation-label']}>
                  {formatMessage(preparationRequiredDialogMessages.title)}
                </XXSmall>
                <XXSmall className={styles['preparation-description']}>
                  {formatMessage(messages.enablePreparationDescription)}
                </XXSmall>
              </div>
              <Toggle
                aria-label={formatMessage(
                  preparationRequiredDialogMessages.title,
                )}
                isSelected={enablePreparation}
                isDisabled={isInstalling}
                onChange={(value: boolean): void =>
                  setEnablePreparation?.(value)
                }
              />
            </div>
            <div className={styles['trust-warning']}>
              <InfoIconOutline className={styles['trust-warning-icon']} />
              <XXSmall>{formatMessage(messages.trustWarning)}</XXSmall>
            </div>
          </div>
        ) : null}

        {isReleaseStep ? null : (
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
              <div className={styles['upload-prompt']}>
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
                  variant={ButtonVariant.Tertiary}
                  size={ButtonSize.Small}
                  onClick={handleButtonClick}
                  Icon={Upload}
                  iconPosition="right"
                >
                  {formatMessage(messages.importFromComputer)}
                </Button>
              </div>
              {type === 'app' ? (
                <div className={styles['upload-formats']}>
                  <span className={styles['upload-support']}>
                    {formatMessage(messages.supportedFormat)}
                  </span>
                  <div className={styles['upload-format-list']}>
                    {APP_FORMATS.map((format) => (
                      <span key={format} className={styles['upload-format']}>
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <span className={styles['upload-support']}>
                  {formatMessage(dialogMessages.bodyLabel)}
                </span>
              )}
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
        )}

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
