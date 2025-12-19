import { Warning } from '@cloud-editor-mono/images/assets/icons';

import { Button, ButtonType } from '../../../components-by-app/app-lab';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './image-warning-dialog.module.scss';

export type ImageWarningDialogLogic = () => {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmAction: () => Promise<void>;
  skipAction: () => Promise<void>;
};

type ImageWarningDialogProps = { logic: ImageWarningDialogLogic };

export const ImageWarningDialog: React.FC<ImageWarningDialogProps> = ({
  logic,
}: ImageWarningDialogProps) => {
  const { open, skipAction, confirmAction, onOpenChange } = logic();

  const onConfirmClick = async (): Promise<void> => {
    await confirmAction();
    onOpenChange(false);
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Software updates"
      footer={
        <>
          <Button type={ButtonType.Secondary} onClick={skipAction}>
            Skip
          </Button>
          <Button onClick={onConfirmClick}>Get Flasher Tool</Button>
        </>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <Warning className={styles['body-icon']} />
      <Medium className={styles['body-title']} bold>
        Your board software is out of date. You may experience missing features
        or functional issues
      </Medium>
      <XSmall className={styles['body-description']}>
        We highly recommend you update your board software using the{' '}
        <button className={styles['button-link']} onClick={confirmAction}>
          Arduino Flasher Tool
        </button>
      </XSmall>
    </AppLabDialog>
  );
};
