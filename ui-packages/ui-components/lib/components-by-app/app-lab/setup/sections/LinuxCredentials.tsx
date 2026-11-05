import { Success } from '@cloud-editor-mono/images/assets/icons';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Input, InputStyle } from '../../../../essential/input';
import { useI18n, XXSmall } from '../../../shared';
import { linuxCredentialsMessages } from '../messages';
import setupStyles from '../setup.module.scss';
import { UseLinuxCredentialsLogic } from '../setup.type';
import styles from './linux-credentials.module.scss';

interface LinuxCredentialsProps {
  logic: ReturnType<UseLinuxCredentialsLogic>;
  unlockAutoFlow?: () => void;
}

const LinuxCredentials = forwardRef((props: LinuxCredentialsProps, ref) => {
  const { logic, unlockAutoFlow } = props;
  const passwordConfirmationInputRef = useRef<HTMLInputElement>(null);
  const {
    isVentunoQ,
    setUserPassword,
    setUserPasswordIsLoading,
    setUserPasswordIsError,
    setUserPasswordIsSuccess,
    setUserPasswordConfirmationIsError,
    userPasswordErrorMsg,
    userPasswordConfirmationErrorMsg,
  } = logic;

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const confirm = useCallback((): void => {
    setUserPassword(password, passwordConfirmation);
  }, [password, passwordConfirmation, setUserPassword]);

  useImperativeHandle(ref, () => ({
    confirm,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    skip: (): void => {}, // No skip functionality for Linux credentials
  }));

  const { formatMessage } = useI18n();

  const handlePasswordEnter = useCallback((): void => {
    passwordConfirmationInputRef.current?.focus();
  }, []);

  const handlePasswordConfirmationEnter = useCallback((): void => {
    if (
      password &&
      passwordConfirmation &&
      !setUserPasswordIsError &&
      !setUserPasswordConfirmationIsError
    ) {
      unlockAutoFlow?.();
      confirm();
    }
  }, [
    confirm,
    password,
    passwordConfirmation,
    setUserPasswordIsError,
    setUserPasswordConfirmationIsError,
    unlockAutoFlow,
  ]);

  return (
    <div className={styles['container']}>
      <div className={setupStyles['input-container']}>
        <Input
          id="username"
          value="arduino"
          inputStyle={InputStyle.AppLab}
          outlined
          disabled
          label={formatMessage(linuxCredentialsMessages.usernameLabel)}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onChange={(): void => {}}
        />
      </div>
      <div className={setupStyles['input-container']}>
        <Input
          id="password"
          value={password}
          inputStyle={InputStyle.AppLab}
          outlined
          disabled={setUserPasswordIsLoading}
          onChange={setPassword}
          onEnter={handlePasswordEnter}
          label={formatMessage(linuxCredentialsMessages.passwordLabel)}
          sensitive
          error={
            setUserPasswordIsError ? new Error(userPasswordErrorMsg) : undefined
          }
        />
      </div>
      <div className={setupStyles['input-container']}>
        <Input
          id="password-confirmation"
          ref={passwordConfirmationInputRef}
          value={passwordConfirmation}
          inputStyle={InputStyle.AppLab}
          outlined
          disabled={setUserPasswordIsLoading}
          onChange={setPasswordConfirmation}
          onEnter={handlePasswordConfirmationEnter}
          label={formatMessage(
            linuxCredentialsMessages.passwordConfirmationLabel,
          )}
          sensitive
          error={
            setUserPasswordConfirmationIsError
              ? new Error(userPasswordConfirmationErrorMsg)
              : undefined
          }
        />
        {setUserPasswordIsSuccess && (
          <XXSmall bold className={setupStyles['message']}>
            <Success />
            {formatMessage(linuxCredentialsMessages.linuxCredentialsSuccess)}
          </XXSmall>
        )}
      </div>
      {isVentunoQ && (
        <div className={styles['distro']}>
          Distribution: Ubuntu, provided by Canonical
        </div>
      )}
    </div>
  );
});

LinuxCredentials.displayName = 'LinuxCredentials';

export default LinuxCredentials;
