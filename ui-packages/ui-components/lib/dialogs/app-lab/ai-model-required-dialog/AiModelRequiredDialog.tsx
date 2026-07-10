import { Ai } from '@cloud-editor-mono/images/assets/icons';

import { Button, ButtonVariant } from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { aiModelRequiredDialogMessages as messages } from '../messages';
import styles from './ai-model-required-dialog.module.scss';
import { AiModelRequiredDialogLogic } from './aiModelRequiredDialog.type';

type AiModelRequiredDialogProps = { logic: AiModelRequiredDialogLogic };

export const AiModelRequiredDialog: React.FC<AiModelRequiredDialogProps> = (
  props: AiModelRequiredDialogProps,
) => {
  const { logic } = props;
  const { open, onOpenChange, onDownloadModel, isExample, modelName } = logic();

  const { formatMessage } = useI18n();

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      footer={
        <Button
          variant={ButtonVariant.Primary}
          onClick={onDownloadModel}
          type="submit"
        >
          {formatMessage(
            isExample
              ? messages.confirmButtonExample
              : messages.confirmButtonApp,
          )}
        </Button>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <Ai className={styles['ai-icon']} />
      <Medium bold>
        {formatMessage(
          isExample
            ? messages.dialogBodyTitleExample
            : messages.dialogBodyTitleApp,
          { modelName },
        )}
      </Medium>
      <XSmall>
        {formatMessage(
          isExample
            ? messages.dialogBodyDescriptionExample
            : messages.dialogBodyDescriptionApp,
          { modelName: <XSmall bold>{modelName}</XSmall> },
        )}
      </XSmall>
    </AppLabDialog>
  );
};
