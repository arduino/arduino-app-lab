import { useEffect, useState } from 'react';

import {
  Button,
  ButtonSize,
  Input,
  InputStyle,
  Small,
  useI18n,
  XXSmall,
} from '../../../components-by-app/app-lab';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { messages } from './messages';
import styles from './password-dialog.module.scss';

export type PasswordDialogError =
  | { kind: 'password' }
  // message is shown in place of the generic text. It comes from the board and is not translated.
  | { kind: 'generic'; message?: string };

export type PasswordDialogLogic = () => {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  isLoading: boolean;
  isSuccess: boolean;
  error?: PasswordDialogError;
};

type PasswordDialogProps = {
  logic: PasswordDialogLogic;
};

export const PasswordDialog: React.FC<PasswordDialogProps> = ({
  logic,
}: PasswordDialogProps) => {
  const { formatMessage } = useI18n();

  const { open, onOpenChange, onConfirm, isLoading, isSuccess, error } =
    logic();

  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
    }
  }, [open]);

  useEffect(() => {
    if (isSuccess) {
      onOpenChange(false);
    }
  }, [isSuccess, onOpenChange]);

  const canConfirm = password.length > 0 && !isLoading;

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.title)}
      onSubmit={(): void => onConfirm(password)}
      footer={
        <Button
          loading={isLoading}
          size={ButtonSize.Small}
          disabled={password.length === 0}
          type="submit"
        >
          {formatMessage(messages.save)}
        </Button>
      }
    >
      <div className={styles['header']}>
        <Small className={styles['subtitle']}>
          {formatMessage(messages.subtitle)}
        </Small>
        <XXSmall className={styles['description']}>
          {formatMessage(messages.description)}
        </XXSmall>
      </div>
      <div className={styles['content']}>
        <Input
          inputStyle={InputStyle.AppLab}
          id="password"
          value={password}
          onChange={setPassword}
          label={formatMessage(messages.password)}
          disabled={isLoading}
          sensitive
          autoFocus
          blurOnEnter={false}
          onEnter={(): void => {
            if (canConfirm) {
              onConfirm(password);
            }
          }}
          error={
            error
              ? new Error(
                  formatMessage(
                    error.kind === 'password'
                      ? messages.passwordWrong
                      : messages.genericError,
                  ),
                )
              : undefined
          }
        />
      </div>
    </AppLabDialog>
  );
};
