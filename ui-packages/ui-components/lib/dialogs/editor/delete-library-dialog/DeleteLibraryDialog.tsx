import { ConfirmActionDialog } from '../../../essential/confirm-action-dialog';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, Small } from '../../../typography';
import { deleteLibraryDialogMessages as messages } from '../messages';
import styles from './delete-library-dialog.module.scss';
import {
  DeleteLibraryDialogData,
  DeleteLibraryDialogLogic,
} from './deleteLibraryDialog.type';

interface DeleteLibraryDialogProps {
  themeClass?: string;
  deleteLibraryDialogLogic: DeleteLibraryDialogLogic;
  data: DeleteLibraryDialogData;
}

const DeleteLibraryDialog: React.FC<DeleteLibraryDialogProps> = (
  props: DeleteLibraryDialogProps,
) => {
  const { themeClass, deleteLibraryDialogLogic, data } = props;

  const { formatMessage } = useI18n();

  const dialogTitle = (
    <>
      <Medium>{formatMessage(messages.actionText)}</Medium>
      <Medium className={styles['library-name']} bold>
        {data.libraryName}
      </Medium>
    </>
  );
  return (
    <ConfirmActionDialog
      headerTitle={formatMessage(messages.dialogTitle)}
      dialogTitle={dialogTitle}
      dialogMessage={<Small>{formatMessage(messages.confirmText)}</Small>}
      dialogCancelButtonLabel={
        <Small uppercase bold>
          {formatMessage(messages.cancelButton)}
        </Small>
      }
      dialogConfirmButtonLabel={
        <Small uppercase bold>
          {formatMessage(messages.confirmButton)}
        </Small>
      }
      confirmActionDialogLogic={deleteLibraryDialogLogic}
      themeClass={themeClass}
    />
  );
};

export default DeleteLibraryDialog;
