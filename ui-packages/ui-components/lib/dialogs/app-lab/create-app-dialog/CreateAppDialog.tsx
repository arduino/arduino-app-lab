import {
  APP_NAME_IN_USE_ERROR,
  APP_NAME_INVALID_CHARACTERS_REGEX,
  AppDetailedInfo,
  BOARD_STORAGE_FULL_ERROR,
  CreateAppRequest,
} from '@cloud-editor-mono/infrastructure';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  Button,
  ButtonVariant,
  EmojiPicker,
  SnackbarProps,
} from '../../../components-by-app/app-lab';
import { Input } from '../../../essential/input';
import { InputStyle } from '../../../essential/input';
import { useI18n } from '../../../i18n/useI18n';
import { XXXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { createAppDialogMessages as messages } from '../messages';
import styles from './create-app-dialog.module.scss';

export type CreateAppDialogLogic = () => {
  open: boolean;
  app?: AppDetailedInfo;
  confirmAction: (request: CreateAppRequest) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  sendNotification: (props: Omit<SnackbarProps, 'onClose' | 'toastId'>) => void;
};

type CreateAppDialogProps = { logic: CreateAppDialogLogic };

const MAX_LENGTH = 80;

export const CreateAppDialog: React.FC<CreateAppDialogProps> = ({
  logic,
}: CreateAppDialogProps) => {
  const { open, app, confirmAction, onOpenChange, sendNotification } = logic();
  const [name, setName] = useState(app?.name ? `Copy of ${app?.name}` : '');
  const [icon, setIcon] = useState(app?.icon ?? '😀');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (app) {
      setName(`Copy of ${app.name}`);
      setIcon(app.icon ?? '😀');
    } else if (!open) {
      setName('');
      setIcon('😀');
    }
    setErrorMessage(undefined);
  }, [app, open]);

  const { formatMessage } = useI18n();

  const onAppNameChange = (value: string): void => {
    if (value.length > MAX_LENGTH) return;
    setName(value);
    setErrorMessage(undefined);
  };

  const validateAppName = (name: string): boolean => {
    // Not the file/folder rule: the app directory is slug.Make(name) server
    // side, so the raw name never becomes a path. Spaces are fine here.
    if (APP_NAME_INVALID_CHARACTERS_REGEX.test(name)) {
      setErrorMessage(formatMessage(messages.appNameInvalidChars));
      return false;
    }
    return true;
  };

  const { mutateAsync: createApp, isLoading } = useMutation(
    ['crate-app'],
    async () => {
      if (name.length === 0) {
        setErrorMessage(formatMessage(messages.appNameRequired));
        return;
      }

      if (!validateAppName(name)) {
        return;
      }

      try {
        const result = await confirmAction({ icon, name });
        if (result) {
          onOpenChange(false);
          sendNotification({
            message: formatMessage(
              app ? messages.successDuplicate : messages.successCreate,
            ),
            variant: 'success',
          });
          return;
        }

        setErrorMessage(formatMessage(messages.appNameInUse));
      } catch (error) {
        if (error instanceof Error && error.message === APP_NAME_IN_USE_ERROR) {
          setErrorMessage(formatMessage(messages.appNameInUse));
          return;
        }
        if (
          error instanceof Error &&
          error.message === BOARD_STORAGE_FULL_ERROR
        ) {
          setErrorMessage(formatMessage(messages.storageFull));
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : formatMessage(
                app ? messages.failedDuplicate : messages.failedCreate,
              );
        setErrorMessage(message);
        sendNotification({ message, variant: 'error' });
      }
    },
  );

  const handleCreateApp = async (): Promise<void> => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await createApp();
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <>
      {createPortal(
        <AppLabDialog
          open={open}
          onOpenChange={onOpenChange}
          title={formatMessage(messages.dialogTitle)}
          onSubmit={handleCreateApp}
          footer={
            <>
              <Button
                variant={ButtonVariant.Secondary}
                onClick={(): void => onOpenChange(false)}
              >
                {formatMessage(messages.cancelButton)}
              </Button>
              <Button
                variant={ButtonVariant.Primary}
                loading={isLoading}
                disabled={name.length === 0 || isLoading}
                type="submit"
              >
                {formatMessage(messages.confirmButton)}
              </Button>
            </>
          }
          classes={{
            body: styles['body'],
          }}
        >
          <EmojiPicker
            value={icon}
            onChange={setIcon}
            classes={{
              emojiPickerButton: styles['emoji-picker-button'],
              emojiPickerButtonOpen: styles['emoji-picker-button-open'],
              emojiPickerContainer: styles['emoji-picker'],
            }}
          />
          <div className={styles['app-name']}>
            <Input
              inputStyle={InputStyle.AppLab}
              type="text"
              value={name}
              onChange={onAppNameChange}
              onEnter={handleCreateApp}
              error={errorMessage ? new Error(errorMessage) : undefined}
              placeholder={formatMessage(messages.inputPlaceholder)}
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
              classes={{
                input: styles['app-name-input'],
                inputContainer: styles['app-name-input-container'],
                error: styles['app-name-input-error'],
                inputError: styles['error-message'],
              }}
              after={
                <XXXSmall className={styles['app-name-length']}>
                  {[name.length, MAX_LENGTH].join(' / ')}
                </XXXSmall>
              }
            />
          </div>
        </AppLabDialog>,
        document.body,
      )}
    </>
  );
};
