import { InfoIconOutline } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import {
  Button,
  ButtonSize,
  Input,
  InputStyle,
  Medium,
  useI18n,
  XXSmall,
  XXXSmall,
} from '../../../components-by-app/app-lab';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './change-password-dialog.module.scss';
import { messages } from './messages';

export type ChangePasswordDialogLogic = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setUserPassword: (password: string, passwordConfirmation: string) => void;
  isLoading: boolean;
  confirmationIsError: boolean;
  isError: boolean;
  isSuccess: boolean;
  errorMsg: string;
  confirmationErrorMsg: string;
};

type ChangePasswordDialogProps = {
  logic: ChangePasswordDialogLogic;
};

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  logic,
}: ChangePasswordDialogProps) => {
  const { formatMessage } = useI18n();

  const {
    open,
    onOpenChange,
    isLoading,
    setUserPassword,
    isSuccess,
    isError,
    confirmationIsError,
    errorMsg,
    confirmationErrorMsg,
  } = logic;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inputValidation, setInputValidation] = useState<Error>();

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setInputValidation(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (isSuccess) {
      onOpenChange(false);
    }
  }, [isSuccess, onOpenChange]);

  const handleConfirm = (): void => {
    if (password !== confirmPassword) {
      setInputValidation(new Error(formatMessage(messages.passwordMismatch)));
      return;
    }
    setUserPassword(password, confirmPassword);
  };

  const hasError = isError || confirmationIsError;
  const showError = hasError || inputValidation;

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.changePassword)}
      onSubmit={handleConfirm}
      footer={
        <Button
          loading={isLoading}
          size={ButtonSize.Small}
          disabled={isLoading || !password || !confirmPassword}
          isSubmit
        >
          {formatMessage(messages.save)}
        </Button>
      }
    >
      <div className={styles['header']}>
        <Medium className={styles['subtitle']}>
          {formatMessage(messages.subtitle)}
        </Medium>
        <XXSmall className={styles['description']}>
          {formatMessage(messages.description, {
            bold: (text: string) => <strong>{text}</strong>,
            br: () => <br />,
          })}
        </XXSmall>
      </div>
      <div className={styles['content']}>
        <Input
          inputStyle={InputStyle.AppLab}
          id="password"
          value={password}
          onChange={(value): void => {
            setPassword(value as string);
            setInputValidation(undefined);
          }}
          label={formatMessage(messages.newPassword)}
          disabled={isLoading}
          sensitive
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus
        />
        <Input
          inputStyle={InputStyle.AppLab}
          id="confirm-password"
          value={confirmPassword}
          onChange={(value): void => {
            setConfirmPassword(value as string);
            setInputValidation(undefined);
          }}
          label={formatMessage(messages.confirmPassword)}
          disabled={isLoading}
          error={
            inputValidation ||
            (hasError
              ? new Error(isError ? errorMsg : confirmationErrorMsg)
              : undefined)
          }
          classes={{
            inputContainer: styles['input-container'],
            error: styles['input-error'],
            inputError: styles['input-error-message'],
          }}
          sensitive
        />

        {/* helperText */}
        <div
          className={clsx(
            styles['helper-text'],
            showError && styles['helper-text--hidden'],
          )}
        >
          <InfoIconOutline />
          <XXXSmall>{formatMessage(messages.helperText)}</XXXSmall>
        </div>
      </div>
    </AppLabDialog>
  );
};
