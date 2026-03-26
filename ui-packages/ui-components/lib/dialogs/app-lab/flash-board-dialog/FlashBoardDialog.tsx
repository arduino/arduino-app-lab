import { Tools } from '@cloud-editor-mono/images/assets/icons';

import {
  Button,
  ButtonType,
  Medium,
  useI18n,
  XSmall,
} from '../../../components-by-app/app-lab';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './flash-board-dialog.module.scss';
import { messages } from './messages';

export type FlashBoardDialogLogic = () => {
  open: boolean;
  confirmAction: () => void;
  onOpenChange: (open: boolean) => void;
  openFlasherTutorial: () => void;
};

type FlashBoardDialogProps = { logic: FlashBoardDialogLogic };

export const FlashBoardDialog: React.FC<FlashBoardDialogProps> = ({
  logic,
}: FlashBoardDialogProps) => {
  const { formatMessage } = useI18n();

  const { open, onOpenChange, confirmAction, openFlasherTutorial } = logic();

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.title)}
      closeable={false}
      onSubmit={confirmAction}
      footer={
        <>
          <Button
            type={ButtonType.Secondary}
            onClick={(): void => onOpenChange(false)}
            uppercase={false}
          >
            {formatMessage(messages.skipButton)}
          </Button>
          <Button
            type={ButtonType.Primary}
            uppercase={false}
            isSubmit
            /* eslint-disable-next-line jsx-a11y/no-autofocus */
            autoFocus
          >
            {formatMessage(messages.updateButton)}
          </Button>
        </>
      }
    >
      <div className={styles['container']}>
        <Tools />
        <Medium className={styles['subtitle']}>
          {formatMessage(messages.subtitle)}
        </Medium>
        <XSmall className={styles['description']}>
          {formatMessage(messages.description, {
            bold: (text: string) => <strong>{text}</strong>,
            link: (text: string) => (
              <button
                type="button"
                className={styles['link']}
                onClick={openFlasherTutorial}
              >
                {text}
              </button>
            ),
          })}
        </XSmall>
      </div>
    </AppLabDialog>
  );
};
