import {
  AppBrickListItem,
  BrickConfigVariable,
  BrickCreateUpdateRequest,
} from '@cloud-editor-mono/infrastructure';
import { capitalize } from 'lodash-es';
import { useEffect, useState } from 'react';

import { Button, ButtonVariant } from '../../../components-by-app/app-lab';
import { Input } from '../../../essential/input';
import { InputStyle } from '../../../essential/input/input.type';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXSmall, XXXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { configureAppBricksDialogMessages as messages } from '../messages';
import styles from './configure-app-bricks-dialog.module.scss';

export type ConfigureAppBricksDialogLogic = () => {
  bricks: AppBrickListItem[];
  open: boolean;
  confirmAction: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
};

type ConfigureAppBricksDialogProps = { logic: ConfigureAppBricksDialogLogic };

interface BrickVariable extends Omit<BrickConfigVariable, 'value'> {
  value: string;
}
type BricksParams = {
  brick: AppBrickListItem;
  modelId?: string;
  variables: BrickVariable[];
}[];

export const ConfigureAppBricksDialog: React.FC<
  ConfigureAppBricksDialogProps
> = ({ logic }: ConfigureAppBricksDialogProps) => {
  const { bricks, open, confirmAction, onOpenChange } = logic();
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<BricksParams>([]);

  const { formatMessage } = useI18n();

  useEffect(() => {
    if (!open) return;

    setParams(
      bricks.reduce<BricksParams>((acc, brick) => {
        if (
          !brick.id ||
          // Older CLIs fill compatible_models on the list; newer ones send [] or null.
          (!brick.require_model &&
            (brick.compatible_models ?? []).length === 0 &&
            (brick.config_variables ?? []).length === 0)
        ) {
          return acc;
        }

        return [
          ...acc,
          {
            brick,
            modelId: brick.model,
            variables:
              brick.config_variables?.map((config) => ({
                ...config,
                value: config.value ?? '',
              })) ?? [],
          },
        ];
      }, []),
    );
  }, [bricks, open]);

  const handleConfirm = async (): Promise<void> => {
    const variables = params.reduce(
      (acc, { brick, modelId, variables }) => ({
        ...acc,
        [brick.id!]: {
          model: modelId,
          variables: variables.reduce(
            (acc, variable) => ({
              ...acc,
              [variable.name!]: variable.value,
            }),
            {},
          ),
        },
      }),
      {},
    );
    setLoading(true);
    try {
      const success = await confirmAction(variables);
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isMissingRequired = params.some(
    ({ brick, modelId, variables }) =>
      (brick.require_model && !modelId) ||
      variables.some(
        (variable) => variable.required && !variable.value.trim().length,
      ),
  );

  const handleEnter = (): void => {
    if (!isMissingRequired && !loading) {
      handleConfirm();
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={handleConfirm}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            onClick={(): void => onOpenChange(false)}
            uppercase={false}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            uppercase={false}
            loading={loading}
            disabled={isMissingRequired}
            type="submit"
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
        {params.map(({ brick, variables }, brickIndex) => (
          <div key={brick.id} className={styles['brick-container']}>
            <XSmall className={styles['brick-name']}>
              {formatMessage(messages.dialogBodyTitle, {
                brickName: brick.name,
              })}
            </XSmall>
            {variables.map((variable, varIndex) => (
              <div key={variable.name} className={styles['param-row']}>
                <Input
                  inputStyle={InputStyle.AppLab}
                  type="text"
                  value={variable.value}
                  autoFocus={brickIndex === 0 && varIndex === 0}
                  blurOnEnter={false}
                  onEnter={handleEnter}
                  onChange={(value: string): void =>
                    setParams((prev) =>
                      prev.map((it) =>
                        it.brick.id === brick.id
                          ? {
                              ...it,
                              variables: it.variables.map((v) =>
                                v.name === variable.name ? { ...v, value } : v,
                              ),
                            }
                          : it,
                      ),
                    )
                  }
                  label={variable.name?.split('_').map(capitalize).join(' ')}
                  required={variable.required}
                />
                <XXSmall>{variable.description}</XXSmall>
              </div>
            ))}
          </div>
        ))}
        <XXXSmall className={styles['brick-description']}>
          {formatMessage(messages.dialogBodyDescription)}
        </XXXSmall>
      </div>
    </AppLabDialog>
  );
};
