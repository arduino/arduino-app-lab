import { useRef } from 'react';

import { Button, ButtonType } from '../../../essential/button';
import { ModalLogic } from '../../../essential/dialog';
import { GenericDialog } from '../../../essential/generic-dialog';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { mobileWarningDialog as messages } from '../messages';
import styles from './mobile-warning-dialog.module.scss';

export type MobileWarningDialogLogic = () => ReturnType<ModalLogic> & {
  devicesLinkUrl: string;
};

export interface MobileWarningDialogProps {
  themeClass?: string;
  data: MobileWarningDialogData;
  mobileWarningDialogLogic: MobileWarningDialogLogic;
}

export interface MobileWarningDialogData {
  handleDismiss: () => void;
  handleClose: () => void;
}

const MobileWarningDialog: React.FC<MobileWarningDialogProps> = (
  props: MobileWarningDialogProps,
) => {
  const {
    mobileWarningDialogLogic,
    themeClass,
    data: { handleDismiss, handleClose },
  } = props;
  const { reactModalProps, devicesLinkUrl } = mobileWarningDialogLogic();

  const dialogRef = useRef<HTMLDivElement>(null);

  const { formatMessage } = useI18n();

  return (
    <GenericDialog
      themeClass={themeClass}
      dialogRef={dialogRef}
      reactModalProps={reactModalProps}
      setIsOpen={handleClose}
    >
      <>
        <GenericDialog.Header
          title={formatMessage(messages.header)}
          onClickClose={handleDismiss}
        ></GenericDialog.Header>
        <GenericDialog.Body>
          <>
            <Medium bold>{formatMessage(messages.title)}</Medium>

            <XSmall className={styles.description}>
              {formatMessage(messages.description, {
                bold: (str: string) => <b>{str}</b>,
              })}
            </XSmall>

            <XSmall>
              {formatMessage(messages.otaDescription, {
                link: (str: string) => (
                  <a
                    className={styles['device-link']}
                    href={devicesLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {str}
                  </a>
                ),
              })}
            </XSmall>
          </>
        </GenericDialog.Body>
        <GenericDialog.Actions>
          <>
            <Button type={ButtonType.Primary} onClick={handleDismiss}>
              {formatMessage(messages.continueButton)}
            </Button>
          </>
        </GenericDialog.Actions>
      </>
    </GenericDialog>
  );
};

export default MobileWarningDialog;
