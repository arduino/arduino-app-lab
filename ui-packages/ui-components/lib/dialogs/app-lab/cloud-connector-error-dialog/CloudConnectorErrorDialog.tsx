import { TriangleSharp } from '@cloud-editor-mono/images/assets/icons';

import { Button, ButtonVariant } from '../../../components-by-app/app-lab';
import { CopyToClipboard } from '../../../essential/copy-to-clipboard';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { cloudConnectorErrorDialogMessages as messages } from '../messages';
import styles from './cloud-connector-error-dialog.module.scss';

export type CloudConnectorErrorDialogLogic = () => {
  open: boolean;
  uhwid: string;
  contactSupportAction: () => void;
  confirmAction: () => void;
  onOpenChange: (open: boolean) => void;
};

type CloudConnectorErrorDialogProps = { logic: CloudConnectorErrorDialogLogic };

export const CloudConnectorErrorDialog: React.FC<
  CloudConnectorErrorDialogProps
> = ({ logic }: CloudConnectorErrorDialogProps) => {
  const { open, uhwid, contactSupportAction, confirmAction, onOpenChange } =
    logic();

  const { formatMessage } = useI18n();

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={confirmAction}
      footer={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            type="submit"
            /* eslint-disable-next-line jsx-a11y/no-autofocus */
            autoFocus
          >
            {formatMessage(messages.confirmButton)}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            onClick={(): void => contactSupportAction()}
          >
            {formatMessage(messages.contactSupportButton)}
          </Button>
        </>
      }
      classes={{
        body: styles['body'],
      }}
    >
      <TriangleSharp className={styles['body-icon']} />
      <Medium className={styles['body-title']}>
        {formatMessage(messages.dialogBodyTitle)}
      </Medium>
      <XSmall className={styles['body-description']}>
        {formatMessage(messages.dialogBodyDescription)}
      </XSmall>
      <div className={styles['copy-container']}>
        <XSmall className={styles['label']}>
          {formatMessage(messages.dialogBodyDescription2)}
        </XSmall>
        <div className={styles['container']}>
          <XSmall className={styles['label']}>
            {formatMessage(messages.uhwidLabel)}
          </XSmall>
          <div className={styles['copy-text']}>
            <XSmall>{uhwid}</XSmall>
            <CopyToClipboard text={uhwid} />
          </div>
        </div>
      </div>
    </AppLabDialog>
  );
};
