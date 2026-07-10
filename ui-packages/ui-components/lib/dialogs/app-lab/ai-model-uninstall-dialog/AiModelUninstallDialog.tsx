import { TriangleSharpOutline } from '@cloud-editor-mono/images/assets/icons';

import {
  AiModelProps,
  BrickDetailModelImpulse,
  Button,
  ButtonSize,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { aiModelUninstallDialogMessages as messages } from '../messages';
import styles from './ai-model-uninstall-dialog.module.scss';

type AiModelUninstallDialogProps = {
  open: boolean;
  isEdgeImpulse: boolean;
  modelId: string;
  selectedImpulse?: BrickDetailModelImpulse;
  onOpenChange: (open: boolean) => void;
  removeModel?: AiModelProps['removeModel'];
};

export const AiModelUninstallDialog: React.FC<AiModelUninstallDialogProps> = (
  props: AiModelUninstallDialogProps,
) => {
  const {
    open,
    modelId,
    selectedImpulse,
    isEdgeImpulse,
    onOpenChange,
    removeModel,
  } = props;

  const { formatMessage } = useI18n();

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            size={ButtonSize.XSmall}
            onClick={(): void => onOpenChange(false)}
            type="submit"
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            size={ButtonSize.XSmall}
            onClick={(): void => {
              removeModel?.(
                isEdgeImpulse
                  ? selectedImpulse?.installedModelId ?? ''
                  : modelId,
                true,
              );
              onOpenChange(false);
            }}
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
      <TriangleSharpOutline className={styles['warning-icon']} />
      <Medium bold>{formatMessage(messages.dialogBodyTitle)}</Medium>
      <XSmall>{formatMessage(messages.dialogBodyDescription)}</XSmall>
    </AppLabDialog>
  );
};
