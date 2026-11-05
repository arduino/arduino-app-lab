import { Bin, Eraser } from '@cloud-editor-mono/images/assets/icons';
import { AppBrickListItem } from '@cloud-editor-mono/infrastructure';
import { useState } from 'react';

import {
  Button,
  ButtonAppearance,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { deleteAppBrickDialogMessages as messages } from '../messages';
import styles from './delete-app-brick-dialog.module.scss';

export type DeleteAppBrickDialogLogic = () => {
  brick: AppBrickListItem | null;
  open: boolean;
  confirmAction: (brickId: string) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
};

type DeleteAppBrickDialogProps = { logic: DeleteAppBrickDialogLogic };

export const DeleteAppBrickDialog: React.FC<DeleteAppBrickDialogProps> = ({
  logic,
}: DeleteAppBrickDialogProps) => {
  const { brick, open, confirmAction, onOpenChange } = logic();
  const [loading, setLoading] = useState(false);

  const { formatMessage } = useI18n();

  const isCustomBrick = brick?.author !== 'Arduino';

  const handleDelete = async (): Promise<void> => {
    if (!brick?.id) return;
    setLoading(true);
    try {
      const result = await confirmAction(brick.id);
      if (result) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={handleDelete}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            onClick={(): void => onOpenChange(false)}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            variant={ButtonVariant.Secondary}
            appearance={ButtonAppearance.Destructive}
            loading={loading}
            iconPosition="right"
            Icon={Bin}
            type="submit"
            autoFocus
          >
            {formatMessage(messages.confirmButton)}
          </Button>
        </>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <Eraser className={styles['body-icon']} />
      <Medium className={styles['body-title']}>
        {isCustomBrick
          ? formatMessage(messages.customBrickBodyTitle, {
              brickName: brick?.name,
            })
          : formatMessage(messages.dialogBodyTitle)}
      </Medium>
      <XSmall className={styles['body-description']}>
        {isCustomBrick
          ? formatMessage(messages.customBrickBodyDescription, {
              brickName: brick?.name,
            })
          : formatMessage(messages.dialogBodyDescription)}
      </XSmall>
    </AppLabDialog>
  );
};
