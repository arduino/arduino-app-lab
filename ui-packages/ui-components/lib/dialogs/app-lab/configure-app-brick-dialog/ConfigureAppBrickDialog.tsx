import {
  BrickConfigVariable,
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import { capitalize } from 'lodash';
import { useEffect, useState } from 'react';

import { Button, ButtonType } from '../../../components-by-app/app-lab';
import { Input } from '../../../essential/input';
import { InputStyle } from '../../../essential/input/input.type';
import { useI18n } from '../../../i18n/useI18n';
import { XXSmall, XXXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { configureAppBrickDialogMessages as messages } from '../messages';
import styles from './configure-app-brick-dialog.module.scss';

export type ConfigureAppBrickDialogLogic = (params: {
  appId: string;
  brick: BrickDetails;
  open: boolean;
}) => {
  brickInstance?: BrickInstance;
  confirmAction: (params: BrickCreateUpdateRequest) => Promise<boolean>;
};

type ConfigureAppBrickDialogProps = {
  open: boolean;
  appId: string;
  brick: BrickDetails;
  setOpen: (open: boolean) => void;
  logic: ConfigureAppBrickDialogLogic;
};

interface BrickVariable extends Omit<BrickConfigVariable, 'value'> {
  value: string;
}

export const ConfigureAppBrickDialog: React.FC<
  ConfigureAppBrickDialogProps
> = ({ open, setOpen, appId, brick, logic }: ConfigureAppBrickDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [variables, setVariables] = useState<BrickVariable[]>([]);

  const { brickInstance, confirmAction } = logic({ appId, brick, open });

  const { formatMessage } = useI18n();

  useEffect(() => {
    setVariables(
      (brickInstance?.config_variables ?? []).map((config) => ({
        ...config,
        value: config.value ?? '',
      })),
    );
  }, [brickInstance?.config_variables]);

  const handleConfirm = async (): Promise<void> => {
    if (!brick.id) return;
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
        <>
          <Button
            type={ButtonType.Secondary}
            onClick={(): void => setOpen(false)}
            uppercase={false}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            type={ButtonType.Primary}
            uppercase={false}
            loading={loading}
            disabled={variables.some(
              (variable) => variable.required && !variable.value.trim().length,
            )}
            isSubmit
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.confirmButton)}
          </Button>
        </>
      }
      classes={{
        root: styles['root'],
        content: styles['content'],
        body: styles['body'],
      }}
    >
      <div className={styles['container']}>
        {variables.map((variable, index) => (
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
              label={variable.name?.split('_').map(capitalize).join(' ')}
              required={variable.required}
              classes={{
                input: styles['input'],
              }}
            />
            <XXSmall>{variable.description}</XXSmall>
          </div>
        ))}
        {variables.length !== 0 && (
          <XXXSmall className={styles['brick-description']}>
            {formatMessage(messages.dialogBodyDescription)}
          </XXXSmall>
        )}
      </div>
    </AppLabDialog>
  );
};
