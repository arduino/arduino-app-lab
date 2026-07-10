import {
  FileOutline,
  FolderOutline,
} from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';

import { Button, ButtonVariant } from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { duplicateFileDialogMessages as messages } from '../messages';
import styles from './duplicate-file-dialog.module.scss';
import { DuplicateFileDialogLogic } from './types';

type DuplicateFileDialogProps = { logic: DuplicateFileDialogLogic };

export const DuplicateFileDialog: React.FC<DuplicateFileDialogProps> = ({
  logic,
}: DuplicateFileDialogProps) => {
  const {
    open,
    fileName,
    conflictType,
    onOverwrite,
    onKeepBoth,
    onOpenChange,
  } = logic();
  const [loading, setLoading] = useState(false);

  const disableOverwrite =
    conflictType === 'file-folder' || conflictType === 'folder-file';
  const disableKeepBoth =
    conflictType === 'file-folder' || conflictType === 'folder-file';
  const isFolderConflict = conflictType?.startsWith('folder');
  const [selectedAction, setSelectedAction] = useState<
    'overwrite' | 'keepBoth' | null
  >(null);

  const { formatMessage } = useI18n();

  const handleOverwrite = async (): Promise<void> => {
    setSelectedAction('overwrite');
    setLoading(true);
    const result = await onOverwrite();
    setLoading(false);

    if (result) {
      onOpenChange(false);
      setSelectedAction(null);
    }
  };

  const handleKeepBoth = async (): Promise<void> => {
    setSelectedAction('keepBoth');
    setLoading(true);
    const result = await onKeepBoth();
    setLoading(false);

    if (result) {
      onOpenChange(false);
      setSelectedAction(null);
    }
  };

  const config = {
    icon: isFolderConflict ? (
      <FolderOutline className={styles['body-icon']} />
    ) : (
      <FileOutline className={styles['body-icon']} />
    ),
    titleMessage:
      conflictType === 'file-file'
        ? messages.fileBodyTitle
        : conflictType === 'folder-folder'
        ? messages.folderBodyTitle
        : messages.nameConflictBodyTitle,
    descriptionMessage:
      conflictType === 'file-file'
        ? messages.fileBodyDescription
        : conflictType === 'folder-folder'
        ? messages.folderBodyDescription
        : conflictType === 'file-folder'
        ? messages.fileFolderConflictDescription
        : messages.folderFileConflictDescription,
    titleValues: { fileName },
    dialogTitleMessage:
      conflictType === 'file-file'
        ? messages.fileConflictTitle
        : conflictType === 'folder-folder'
        ? messages.folderConflictTitle
        : messages.nameConflictTitle,
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(config.dialogTitleMessage)}
      footer={
        <>
          {!disableKeepBoth && (
            <Button
              variant={
                disableOverwrite ? ButtonVariant.Primary : ButtonVariant.Secondary
              }
              onClick={handleKeepBoth}
              loading={loading && selectedAction === 'keepBoth'}
              type="submit"
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus={disableOverwrite}
              classes={{
                button: styles['action-button'],
                textButtonText: styles['action-button-text'],
              }}
            >
              {formatMessage(messages.keepBothButton)}
            </Button>
          )}

          {disableKeepBoth && (
            <Button
              variant={ButtonVariant.Primary}
              onClick={() => onOpenChange(false)}
              type="submit"
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
              classes={{
                button: styles['action-button'],
                textButtonText: styles['action-button-text'],
              }}
            >
              {formatMessage(messages.okGotItButton)}
            </Button>
          )}

          {!disableOverwrite && (
            <Button
              variant={ButtonVariant.Primary}
              onClick={handleOverwrite}
              loading={loading && selectedAction === 'overwrite'}
              type="submit"
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
            >
              {formatMessage(messages.overwriteButton)}
            </Button>
          )}
        </>
      }
      classes={{
        body: styles['body'],
      }}
    >
      {open && (
        <>
          {config.icon}

          <Medium bold className={styles['body-title']}>
            {formatMessage(config.titleMessage, config.titleValues)}
          </Medium>

          <XSmall className={styles['body-description']}>
            {formatMessage(config.descriptionMessage, config.titleValues)}
          </XSmall>
        </>
      )}
    </AppLabDialog>
  );
};
