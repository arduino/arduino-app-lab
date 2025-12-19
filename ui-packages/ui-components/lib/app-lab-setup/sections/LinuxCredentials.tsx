import { Error, Success } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { forwardRef, useImperativeHandle, useState } from 'react';

import { UseLinuxCredentialsLogic } from '../../app-lab-settings';
import { Input } from '../../essential/input';
import { InputStyle } from '../../essential/input/input.type';
import { useI18n } from '../../i18n/useI18n';
import { XSmall, XXSmall } from '../../typography';
import { linuxCredentialsMessages } from '../messages';
import setupStyles from '../setup.module.scss';
import styles from './linux-credentials.module.scss';

interface LinuxCredentialsProps {
  logic: ReturnType<UseLinuxCredentialsLogic>;
}

const LinuxCredentials = forwardRef((props: LinuxCredentialsProps, ref) => {
  const { logic } = props;
  const {
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

  useImperativeHandle(ref, () => ({
    confirm: (): void => setUserPassword(password, passwordConfirmation),
  }));

  const { formatMessage } = useI18n();

  return (
    <div className={styles['container']}>
      <XSmall className={styles['description']}>
        {formatMessage(linuxCredentialsMessages.descriptionLabel)}
      </XSmall>
      <div className={setupStyles['input-container']}>
        <Input
          id="username"
          value="arduino"
          inputStyle={InputStyle.AppLab}
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
          disabled={setUserPasswordIsLoading}
          onChange={setPassword}
          label={formatMessage(linuxCredentialsMessages.passwordLabel)}
          sensitive
        />
        {setUserPasswordIsError && (
          <XXSmall
            bold
            className={clsx(setupStyles['message'], setupStyles['error'])}
          >
            <Error />
            {userPasswordErrorMsg ||
              formatMessage(linuxCredentialsMessages.linuxCredentialsError)}
          </XXSmall>
        )}
      </div>
      <div className={setupStyles['input-container']}>
        <Input
          id="password-confirmation"
          value={passwordConfirmation}
          inputStyle={InputStyle.AppLab}
          disabled={setUserPasswordIsLoading}
          onChange={setPasswordConfirmation}
          label={formatMessage(
            linuxCredentialsMessages.passwordConfirmationLabel,
          )}
          sensitive
        />
        {setUserPasswordConfirmationIsError && (
          <XXSmall
            bold
            className={clsx(setupStyles['message'], setupStyles['error'])}
          >
            <Error />
            {userPasswordConfirmationErrorMsg ||
              formatMessage(linuxCredentialsMessages.linuxCredentialsError)}
          </XXSmall>
        )}
        {setUserPasswordIsSuccess && (
          <XXSmall bold className={setupStyles['message']}>
            <Success />
            {formatMessage(linuxCredentialsMessages.linuxCredentialsSuccess)}
          </XXSmall>
        )}
      </div>
    </div>
  );
});

LinuxCredentials.displayName = 'LinuxCredentials';

export default LinuxCredentials;
