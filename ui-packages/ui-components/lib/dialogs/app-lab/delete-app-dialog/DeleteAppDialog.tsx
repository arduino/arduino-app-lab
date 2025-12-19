import { Bin } from '@cloud-editor-mono/images/assets/icons';
import { useMutation } from '@tanstack/react-query';

import { Button, ButtonType } from '../../../components-by-app/app-lab';
import { ButtonVariant } from '../../../essential/app-lab-button';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { deleteAppDialogMessages as messages } from '../messages';
import styles from './delete-app-dialog.module.scss';

export type DeleteAppDialogLogic = () => {
  open: boolean;
  appName?: string;
  confirmAction: () => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
};

type DeleteAppDialogProps = { logic: DeleteAppDialogLogic };

export const DeleteAppDialog: React.FC<DeleteAppDialogProps> = ({
  logic,
}: DeleteAppDialogProps) => {
  const { open, appName, confirmAction, onOpenChange } = logic();

  const { formatMessage } = useI18n();

  const { mutateAsync: handleDeleteApp, isLoading } = useMutation(
    ['delete-app'],
    async (): Promise<void> => {
      const result = await confirmAction();
      if (result) {
        onOpenChange(false);
      }
    },
  );

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      footer={
        <>
          <Button
            type={ButtonType.Secondary}
            onClick={(): void => onOpenChange(false)}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            type={ButtonType.Secondary}
            variant={ButtonVariant.Destructive}
            loading={isLoading}
            onClick={handleDeleteApp}
            Icon={Bin}
            iconPosition="right"
          >
            {formatMessage(messages.confirmButton)}
          </Button>
        </>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <Bin className={styles['body-icon']} />
      <Medium className={styles['body-title']}>
        {formatMessage(messages.dialogBodyTitle, {
          appName,
        })}
      </Medium>
      <XSmall className={styles['body-description']}>
        {formatMessage(messages.dialogBodyDescription)}
      </XSmall>
    </AppLabDialog>
  );
};
