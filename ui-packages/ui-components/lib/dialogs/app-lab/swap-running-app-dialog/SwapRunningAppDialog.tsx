import { TriangleSharp } from '@cloud-editor-mono/images/assets/icons';

import {
  AppLabDialog,
  Button,
  ButtonType,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XXSmall } from '../../../typography';
import { swapRunningAppDialogMessages as messages } from '../messages';
import styles from './swap-running-app-dialog.module.scss';
import { SwapRunningAppDialogLogic } from './swapRunningAppDialog.type';

export interface SwapRunningDialogProps {
  themeClass?: string;
  swapRunningAppDialogLogic: SwapRunningAppDialogLogic;
}

type SwapRunningAppDialogProps = { logic: SwapRunningAppDialogLogic };

export const SwapRunningAppDialog: React.FC<SwapRunningAppDialogProps> = ({
  logic,
}: SwapRunningAppDialogProps) => {
  const { formatMessage } = useI18n();
  const { open, setOpen, handleSwap } = logic();

  return (
    <AppLabDialog
      open={open}
      title="Swap Running App"
      footer={
        <>
          <Button
            type={ButtonType.Secondary}
            onClick={(): void => setOpen(false)}
          >
            {formatMessage(messages.cancelButton)}
          </Button>
          <Button type={ButtonType.Primary} onClick={handleSwap}>
            {formatMessage(messages.confirmButton)}
          </Button>
        </>
      }
    >
      <>
        <TriangleSharp className={styles['body-icon']} />
        <Medium className={styles['body-title']}>
          {formatMessage(messages.dialogBodyTitle)}
        </Medium>
        <XXSmall className={styles['body-description']}>
          {formatMessage(messages.dialogBodyDescription)}
        </XXSmall>
      </>
    </AppLabDialog>
  );
};
