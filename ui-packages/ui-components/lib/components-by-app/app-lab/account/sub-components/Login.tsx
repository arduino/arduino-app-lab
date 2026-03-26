import {
  AccountArduinoCloud,
  AccountConnectedBoards,
  AccountCustomAiModels,
  ArduinoLogo,
} from '@cloud-editor-mono/images/assets/icons';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';

import SkipLoginDialog from '../../../../dialogs/app-lab/skip-login-dialog/SkipLoginDialog';
import {
  AppLabButton as Button,
  ButtonSize,
  ButtonType,
} from '../../../../essential/app-lab-button';
import { useI18n } from '../../../../i18n/useI18n';
import { Large, XSmall } from '../../../../typography';
import styles from '../account.module.scss';
import { messages } from '../messages';

interface LoginProps {
  login: (data?: { isFromAccount: boolean }) => void;
  isSetupFlow?: boolean;
  skip: () => void;
}

const Login = forwardRef((props: LoginProps, ref) => {
  const { isSetupFlow, login, skip } = props;

  const { formatMessage } = useI18n();
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    confirm: (): void => login(),
    skip: (): void => setIsSkipDialogOpen(true),
  }));

  const handleSkipLogin = useCallback(() => {
    skip();
    setIsSkipDialogOpen(false);
  }, [skip]);

  const handleCloseDialog = useCallback(() => {
    setIsSkipDialogOpen(false);
  }, []);

  return (
    <div className={styles['login-container']}>
      <SkipLoginDialog
        open={isSkipDialogOpen}
        onConfirm={handleSkipLogin}
        onClose={handleCloseDialog}
      />
      {isSetupFlow ? (
        <XSmall className={styles['subtitle']}>
          {formatMessage(messages.setupSubtitle)}
        </XSmall>
      ) : null}
      <div className={styles['login-content']}>
        {!isSetupFlow ? (
          <div className={styles['title-section']}>
            <Large bold>{formatMessage(messages.title)}</Large>
            <XSmall>{formatMessage(messages.subtitle)}</XSmall>
          </div>
        ) : null}
        <div className={styles['features-list']}>
          <XSmall className={styles['feature-item']}>
            <div className={styles['feature-icon']}>
              <AccountCustomAiModels />
            </div>
            {formatMessage(messages.customAiModels)}
          </XSmall>
          <XSmall className={styles['feature-item']}>
            <div className={styles['feature-icon']}>
              <AccountArduinoCloud />
            </div>
            {formatMessage(messages.arduinoCloud)}
          </XSmall>
          <XSmall className={styles['feature-item']}>
            <div className={styles['feature-icon']}>
              <AccountConnectedBoards />
            </div>
            {formatMessage(messages.connectedBoards)}
          </XSmall>
        </div>
        <Button
          type={ButtonType.Secondary}
          size={ButtonSize.XSmall}
          onClick={(): void => {
            login({ isFromAccount: true });
          }}
          classes={{
            button: styles['login-button'],
          }}
        >
          {formatMessage(messages.signInButton)}
          <ArduinoLogo />
        </Button>
      </div>
    </div>
  );
});

Login.displayName = 'Login';

export default Login;
