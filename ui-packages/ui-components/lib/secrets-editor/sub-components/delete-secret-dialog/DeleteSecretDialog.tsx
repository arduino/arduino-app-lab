import { Triangle } from '@cloud-editor-mono/images/assets/icons';

import { ConfirmActionDialog } from '../../../essential/confirm-action-dialog';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, Small, XSmall } from '../../../typography';
import { deleteSecretDialogMessages as messages } from '../../messages';
import styles from './delete-secret-dialog.module.scss';
import {
  type DeleteSecretDialogData,
  type DeleteSecretDialogLogic,
} from './deleteSecretDialog.type';

interface DeleteSecretProps {
  themeClass?: string;
  deleteSecretDialogLogic: DeleteSecretDialogLogic;
  data: DeleteSecretDialogData;
}

const DeleteSecretDialog: React.FC<DeleteSecretProps> = (
  props: DeleteSecretProps,
) => {
  const { themeClass, deleteSecretDialogLogic, data } = props;

  const { formatMessage } = useI18n();

  const dialogTitle = (
    <div className={styles['action-title']}>
      <Medium>{formatMessage(messages.actionTitle)}</Medium>
      <Medium className={styles['sketch-name']} bold>
        {data.secretName}
      </Medium>
    </div>
  );

  const dialogMessage = (
    <div>
      <XSmall>{formatMessage(messages.actionDescription)}</XSmall>
      <div className={styles['warning-message']}>
        <div className={styles['warning-icon']}>
          <Triangle />
        </div>
        <p>
          <XSmall>{formatMessage(messages.warningDescription)}</XSmall>
        </p>
      </div>
    </div>
  );

  return (
    <ConfirmActionDialog
      headerTitle={formatMessage(messages.dialogTitle)}
      dialogTitle={dialogTitle}
      dialogMessage={dialogMessage}
      dialogCancelButtonLabel={
        <Small uppercase bold>
          {formatMessage(messages.cancelButton)}
        </Small>
      }
      dialogConfirmButtonLabel={
        <Small uppercase bold>
          {formatMessage(messages.deleteButton)}
        </Small>
      }
      confirmActionDialogLogic={deleteSecretDialogLogic}
      themeClass={themeClass}
    />
  );
};

export default DeleteSecretDialog;
