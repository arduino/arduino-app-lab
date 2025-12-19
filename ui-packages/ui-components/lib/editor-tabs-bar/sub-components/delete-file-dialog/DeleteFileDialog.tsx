import { ConfirmActionDialog } from '../../../essential/confirm-action-dialog';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, Small } from '../../../typography';
import { messages } from '../messages';
import styles from './delete-file-dialog.module.scss';
import { DeleteFileDialogLogic } from './deleteFileDialog.type';

interface DeleteFileDialogProps {
  themeClass?: string;
  deleteFileDialogLogic: DeleteFileDialogLogic;
}

const DeleteFileDialog: React.FC<DeleteFileDialogProps> = (
  props: DeleteFileDialogProps,
) => {
  const { themeClass, deleteFileDialogLogic } = props;
  const { fileFullName } = deleteFileDialogLogic();

  const { formatMessage } = useI18n();

  const dialogTitle = (
    <div className={styles['message-title']}>
      <Medium>{formatMessage(messages.deleteFileDialogMessage)}</Medium>
      <Medium className={styles['message-title-file-name']} bold>
        {formatMessage(messages.deleteFileDialogMessageName, {
          fileFullName,
        })}
      </Medium>
    </div>
  );

  return (
    <ConfirmActionDialog
      headerTitle={formatMessage(messages.deleteFileDialogTitle)}
      dialogTitle={dialogTitle}
      dialogMessage={
        <Small>{formatMessage(messages.deleteFileDialogConfirmMessage)}</Small>
      }
      dialogCancelButtonLabel={
        <Small uppercase bold>
          {formatMessage(messages.deleteFileDialogCancelButton)}
        </Small>
      }
      dialogConfirmButtonLabel={
        <Small uppercase bold>
          {formatMessage(messages.deleteFileDialogConfirmButton)}
        </Small>
      }
      confirmActionDialogLogic={deleteFileDialogLogic}
      themeClass={themeClass}
    />
  );
};

export default DeleteFileDialog;
