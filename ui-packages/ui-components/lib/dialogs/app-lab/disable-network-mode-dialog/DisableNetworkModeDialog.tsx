import { Terminal } from '@cloud-editor-mono/images/assets/icons';

import {
  Button,
  ButtonType,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { disableNetworkModeDialogMessages as messages } from '../messages';
import styles from './disable-network-mode-dialog.module.scss';

type DisableNetworkModeDialogProps = {
  open: boolean;
  confirmAction: () => void;
  onOpenChange: (open: boolean) => void;
};

export const DisableNetworkModeDialog: React.FC<
  DisableNetworkModeDialogProps
> = (props: DisableNetworkModeDialogProps) => {
  const { open, confirmAction, onOpenChange } = props;

  const { formatMessage } = useI18n();

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
            onClick={confirmAction}
          >
            {formatMessage(messages.confirmButton)}
          </Button>
        </>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <Terminal className={styles['body-icon']} />
      <Medium className={styles['body-title']}>
        {formatMessage(messages.dialogBodyTitle)}
      </Medium>
      <XSmall className={styles['body-description']}>
        {formatMessage(messages.dialogBodyDescription)}
      </XSmall>
    </AppLabDialog>
  );
};
