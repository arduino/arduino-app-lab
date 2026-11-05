import {
  FileOutline,
  FolderOutline,
} from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';

import {
  Button,
  ButtonAppearance,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { deleteTreeItemDialogMessages as messages } from '../messages';
import styles from './delete-tree-item-dialog.module.scss';

export type DeleteTreeItemDialogLogic = () => {
  open: boolean;
  fileName?: string;
  isDirectory: boolean;
  confirmAction: () => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
};

type DeleteTreeItemDialogProps = { logic: DeleteTreeItemDialogLogic };

export const DeleteTreeItemDialog: React.FC<DeleteTreeItemDialogProps> = ({
  logic,
}: DeleteTreeItemDialogProps) => {
  const { open, fileName, isDirectory, confirmAction, onOpenChange } = logic();
  const [loading, setLoading] = useState(false);

  const { formatMessage } = useI18n();

  const handleDelete = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await confirmAction();
      if (result) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const config = isDirectory
    ? {
        icon: <FolderOutline className={styles['body-icon']} />,
        titleMessage: messages.directoryBodyTitle,
        descriptionMessage: messages.directoryBodyDescription,
        titleValues: { fileName },
        descriptionValues: { fileName },
        dialogTitleMessage: messages.deleteFolderTitle,
      }
    : {
        icon: <FileOutline className={styles['body-icon']} />,
        titleMessage: messages.fileBodyTitle,
        descriptionMessage: messages.fileBodyDescription,
        titleValues: { fileName },
        descriptionValues: undefined,
        dialogTitleMessage: messages.deleteFileTitle,
      };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(config.dialogTitleMessage)}
      onSubmit={handleDelete}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            onClick={() => onOpenChange(false)}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>

          <Button
            variant={ButtonVariant.Secondary}
            appearance={ButtonAppearance.Destructive}
            loading={loading}
            iconPosition="right"
            type="submit"
            autoFocus
          >
            {formatMessage(messages.confirmButton)}
          </Button>
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
            {formatMessage(config.descriptionMessage, config.descriptionValues)}
          </XSmall>
        </>
      )}
    </AppLabDialog>
  );
};
