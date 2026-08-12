import { AccountArduinoCloud } from '@cloud-editor-mono/images/assets/icons';
import { useEffect, useState } from 'react';

import {
  Button,
  ButtonAppearance,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { cloudConnectorDisconnectDialogMessages as messages } from '../messages';
import styles from './cloud-connector-disconnect-dialog.module.scss';

export type CloudConnectorDisconnectDialogLogic = () => {
  open: boolean;
  loggedIn: boolean;
  login: () => void;
  confirmAction: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

type CloudConnectorDisconnectDialogProps = {
  logic: CloudConnectorDisconnectDialogLogic;
};

export const CloudConnectorDisconnectDialog: React.FC<
  CloudConnectorDisconnectDialogProps
> = ({ logic }: CloudConnectorDisconnectDialogProps) => {
  const [loginRequested, setLoginRequested] = useState(false);
  const { loggedIn, open, login, confirmAction, onOpenChange } = logic();

  const { formatMessage } = useI18n();

  const confirm = (): void => {
    if (!loggedIn) {
      setLoginRequested(true);
      login();
    } else {
      setLoginRequested(false);
      confirmAction();
    }
  };

  useEffect(() => {
    if (loggedIn && loginRequested) {
      confirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, loginRequested]);

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={confirm}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            onClick={(): void => onOpenChange(false)}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            variant={ButtonVariant.Secondary}
            appearance={ButtonAppearance.Destructive}
            type="submit"
            /* eslint-disable-next-line jsx-a11y/no-autofocus */
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
