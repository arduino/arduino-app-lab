import {
  BrickConfigVariable,
  BrickCreateUpdateRequest,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import { capitalize } from 'lodash-es';
import { useEffect, useState } from 'react';

import { Button, ButtonVariant } from '../../../components-by-app/app-lab';
import { Input } from '../../../essential/input';
import { InputStyle } from '../../../essential/input';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { configureAppBrickDialogMessages as messages } from '../messages';
import styles from './configure-app-brick-dialog.module.scss';

const SETUP_BOARD_URL = 'https://app.arduino.cc/devices/new?type=unoq';
const FOLLOW_INSTRUCTIONS_URL =
  'https://docs.arduino.cc/arduino-cloud/features/manual-device/';

export type ConfigureAppBrickDialogLogic = (params: {
  appId: string;
  brickId?: string;
  open: boolean;
}) => {
  brickInstance?: BrickInstance;
  confirmAction: (params: BrickCreateUpdateRequest) => Promise<boolean>;
};

type ConfigureAppBrickDialogProps = {
  open: boolean;
  appId: string;
  brickId?: string;
  isCustomBrick?: boolean;
  setOpen: (open: boolean) => void;
  logic: ConfigureAppBrickDialogLogic;
  onOpenExternal: (url: string) => void;
};

interface BrickVariable extends Omit<BrickConfigVariable, 'value'> {
  value: string;
}

export const ConfigureAppBrickDialog: React.FC<
  ConfigureAppBrickDialogProps
> = ({
  open,
  setOpen,
  appId,
  brickId,
  logic,
  onOpenExternal,
}: ConfigureAppBrickDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [variables, setVariables] = useState<BrickVariable[]>([]);

  const { brickInstance, confirmAction } = logic({ appId, brickId, open });

  const { formatMessage } = useI18n();

  useEffect(() => {
    if (open && brickInstance?.config_variables) {
      setVariables(
        brickInstance.config_variables.map((config) => ({
          ...config,
          value: config.value ?? '',
        })),
      );
    }
  }, [open, brickInstance?.config_variables]);

  const handleConfirm = async (): Promise<void> => {
    if (!brickId) return;
    setLoading(true);

    const success = await confirmAction({
      variables: variables.reduce(
        (acc, variable) => ({
          ...acc,
          [variable.name!]: variable.value,
        }),
        {},
      ),
    });
    setLoading(false);
    if (success) {
      setOpen(false);
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={setOpen}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={handleConfirm}
      footer={
        <Button
          variant={ButtonVariant.Primary}
          uppercase={false}
          loading={loading}
          disabled={variables.some(
            (variable) => variable.required && !variable.value.trim().length,
          )}
          type="submit"
          classes={{
            button: styles['action-button'],
            textButtonText: styles['action-button-text'],
          }}
        >
          {formatMessage(messages.confirmButton)}
        </Button>
      }
      classes={{
        root: styles['root'],
        content: styles['content'],
        body: styles['body'],
      }}
    >
      <div className={styles['container']}>
        {variables.map((variable, index) => {
          const isDeviceId = variable.name === 'arduino_device_id';
          const isSecret = variable.name === 'arduino_secret';

          return (
            <div key={variable.name} className={styles['param-row']}>
              <Input
                inputStyle={InputStyle.AppLab}
                type="text"
                value={variable.value}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus={index === 0}
                onChange={(value: string): void =>
                  setVariables((prev) =>
                    prev.map((v) =>
                      v.name === variable.name ? { ...v, value } : v,
                    ),
                  )
                }
                label={
                  isDeviceId
                    ? formatMessage(messages.deviceIdLabel)
                    : isSecret
                    ? formatMessage(messages.secretLabel)
                    : variable.name?.split('_').map(capitalize).join(' ')
                }
                required={variable.required}
                classes={{
                  input: styles['input'],
                }}
              />
              <XSmall className={styles['field-description']}>
                {isDeviceId ? (
                  <>
                    {formatMessage(messages.deviceIdDescription)}{' '}
                    <a
                      href={SETUP_BOARD_URL}
                      onClick={(e): void => {
                        e.preventDefault();
                        onOpenExternal(SETUP_BOARD_URL);
                      }}
                      className={styles['link']}
                    >
                      {formatMessage(messages.deviceIdLink)}
                    </a>
                  </>
                ) : isSecret ? (
                  <>
                    {formatMessage(messages.secretDescription)}{' '}
                    <a
                      href={FOLLOW_INSTRUCTIONS_URL}
                      onClick={(e): void => {
                        e.preventDefault();
                        onOpenExternal(FOLLOW_INSTRUCTIONS_URL);
                      }}
                      className={styles['link']}
                    >
                      {formatMessage(messages.secretLink)}
                    </a>
                  </>
                ) : (
                  variable.description
                )}
              </XSmall>
            </div>
          );
        })}
        {variables.length !== 0 && (
          <XXXSmall className={styles['brick-description']}>
            {formatMessage(messages.dialogBodyDescription)}
          </XXXSmall>
        )}
      </div>
    </AppLabDialog>
  );
};
