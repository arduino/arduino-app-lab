import { Bin, Eraser } from '@cloud-editor-mono/images/assets/icons';
import { BrickInstance } from '@cloud-editor-mono/infrastructure';
import { useState } from 'react';

import {
  Button,
  ButtonType,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { deleteAppBrickDialogMessages as messages } from '../messages';
import styles from './delete-app-brick-dialog.module.scss';

export type DeleteAppBrickDialogLogic = () => {
  brick: BrickInstance | null;
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

  const handleDelete = async (): Promise<void> => {
    if (!brick?.id) return;
    setLoading(true);
    const result = await confirmAction(brick.id);
    setLoading(false);
    if (result) {
      onOpenChange(false);
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      footer={
        <>
          <Button
            type={ButtonType.Secondary}
            onClick={(): void => onOpenChange(false)}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button
            type={ButtonType.Secondary}
            variant={ButtonVariant.Destructive}
            loading={loading}
            onClick={handleDelete}
            iconPosition="right"
            Icon={Bin}
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
        {formatMessage(messages.dialogBodyTitle)}
      </Medium>
      <XSmall className={styles['body-description']}>
        {formatMessage(messages.dialogBodyDescription)}
      </XSmall>
    </AppLabDialog>
  );
};
