import { ConfirmActionDialog } from '../../../essential/confirm-action-dialog';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, Small } from '../../../typography';
import { deleteSketchDialogMessages as messages } from '../../editor/messages';
import styles from './delete-sketch-dialog.module.scss';
import { DeleteSketchDialogLogic } from './deleteSketchDialog.type';

interface DeleteSketchDialogData {
  sketchId: string;
  sketchName: string;
}

interface DeleteSketchDialogProps {
  themeClass?: string;
  deleteSketchDialogLogic: DeleteSketchDialogLogic;
  data: DeleteSketchDialogData;
}

const DeleteSketchDialog: React.FC<DeleteSketchDialogProps> = (
  props: DeleteSketchDialogProps,
) => {
  const { themeClass, deleteSketchDialogLogic, data } = props;

  const { formatMessage } = useI18n();

  const dialogTitle = (
    <>
      <Medium>{formatMessage(messages.actionText)}</Medium>
      <Medium className={styles['sketch-name']} bold>
        {data.sketchName}
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
      confirmActionDialogLogic={deleteSketchDialogLogic}
      themeClass={themeClass}
    />
  );
};

export default DeleteSketchDialog;
