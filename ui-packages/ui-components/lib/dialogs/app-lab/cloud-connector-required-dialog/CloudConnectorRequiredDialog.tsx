import { AccountArduinoCloud } from '@cloud-editor-mono/images/assets/icons';

import { Button, ButtonVariant } from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { cloudConnectorRequiredDialogMessages as messages } from '../messages';
import styles from './cloud-connector-required-dialog.module.scss';

export type CloudConnectorRequiredDialogLogic = () => {
  open: boolean;
  confirmAction: () => void;
  onOpenChange: (open: boolean) => void;
};

type CloudConnectorRequiredDialogProps = {
  logic: CloudConnectorRequiredDialogLogic;
};

export const CloudConnectorRequiredDialog: React.FC<
  CloudConnectorRequiredDialogProps
> = ({ logic }: CloudConnectorRequiredDialogProps) => {
  const { open, confirmAction, onOpenChange } = logic();

  const { formatMessage } = useI18n();

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={confirmAction}
      footer={
        <Button
          variant={ButtonVariant.Secondary}
          type="submit"
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus
        >
          {formatMessage(messages.confirmButton)}
        </Button>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <AccountArduinoCloud className={styles['body-icon']} />
      <Medium className={styles['body-title']}>
        {formatMessage(messages.dialogBodyTitle)}
      </Medium>
      <XSmall className={styles['body-description']}>
        {formatMessage(messages.dialogBodyDescription)}
      </XSmall>
    </AppLabDialog>
  );
};
