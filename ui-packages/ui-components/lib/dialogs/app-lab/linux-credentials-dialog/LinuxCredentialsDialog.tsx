import clsx from 'clsx';
import React, { useRef } from 'react';

import {
  Button,
  ButtonSize,
  ButtonVariant,
  useI18n,
} from '../../../components-by-app/app-lab';
import { Input, InputStyle } from '../../../essential/input';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './linux-credentials-dialog.module.scss';
import { linuxCredentialsDialogMessages as messages } from './messages';

export type LinuxCredentialsDialogLogic = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
};

type LinuxCredentialsDialogProps = {
  logic: LinuxCredentialsDialogLogic;
};

export const LinuxCredentialsDialog: React.FC<LinuxCredentialsDialogProps> = ({
  logic,
}: LinuxCredentialsDialogProps) => {
  const { formatMessage } = useI18n();
  const { open, onSubmit, onCancel, isLoading, error } = logic;

  const [password, setPassword] = React.useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setPassword('');
      setTimeout(() => passwordRef.current?.focus(), 10);
    }
  }, [open]);

  const handleSubmit = async (): Promise<void> => {
    await onSubmit(password);
  };

  return (
    <AppLabDialog
      open={open}
      title={formatMessage(messages.title)}
      closeable={!isLoading}
      classes={{
        root: styles['password-prompt'],
        content: styles['password-prompt-content'],
        body: styles['password-prompt-body'],
        footer: styles['password-prompt-footer'],
      }}
      onOpenChange={logic.onOpenChange}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            size={ButtonSize.Small}
            variant={ButtonVariant.Secondary}
            onClick={onCancel}
            disabled={isLoading}
          >
            {formatMessage(messages.cancel)}
          </Button>
          <Button
            size={ButtonSize.Small}
            variant={ButtonVariant.Primary}
            loading={isLoading}
            disabled={!password || isLoading}
            type="submit"
          >
            {formatMessage(messages.confirm)}
          </Button>
        </>
      }
    >
      <Input
        inputStyle={InputStyle.AppLab}
        type="text"
        label={formatMessage(messages.usernameLabel)}
        value="arduino"
        disabled
        onChange={(): null => null}
        classes={{
          input: clsx([
            styles['input'],
            styles['username'],
            styles['disabled'],
          ]),
        }}
      />
      <Input
        inputRef={passwordRef}
        inputStyle={InputStyle.AppLab}
        value={password}
        sensitive={true}
        onChange={(value: string): void => {
          setPassword(value);
        }}
        error={error ? new Error(error) : undefined}
        placeholder=""
        label={formatMessage(messages.passwordLabel)}
        classes={{
          input: clsx([styles['input'], styles['password']]),
          inputContainer: clsx(styles['app-name-input-container']),
          error: clsx(styles['app-name-input-error']),
          inputError: clsx(styles['error-message']),
        }}
        onKeyDown={(e): void => {
          if (e.key === 'Enter' && password && !isLoading) {
            handleSubmit();
          }
        }}
      />
    </AppLabDialog>
  );
};
