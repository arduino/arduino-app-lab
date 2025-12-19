import { useRef } from 'react';

import { Text } from '../../typography';
import { Button, ButtonType } from '../button';
import { GenericDialog } from '../generic-dialog';
import styles from './confirm-action-dialog.module.scss';
import { ConfirmActionDialogLogic } from './confirmActionDialog.type';

export interface ConfirmActionDialogProps {
  themeClass?: string;
  confirmActionDialogLogic: ConfirmActionDialogLogic;
  headerTitle: string;
  dialogTitle: string | JSX.Element;
  dialogMessage: string | JSX.Element;
  dialogCancelButtonLabel: string | JSX.Element;
  dialogConfirmButtonLabel: string | JSX.Element;
}

const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = (
  props: ConfirmActionDialogProps,
) => {
  const {
    confirmActionDialogLogic,
    themeClass,
    headerTitle,
    dialogTitle,
    dialogMessage,
    dialogCancelButtonLabel,
    dialogConfirmButtonLabel,
  } = props;

  const { reactModalProps, setIsOpen, confirmAction, cancelAction, isLoading } =
    confirmActionDialogLogic();

  const dialogRef = useRef<HTMLDivElement>(null);

  return (
    <GenericDialog
      dialogRef={dialogRef}
      reactModalProps={reactModalProps}
      themeClass={themeClass}
      setIsOpen={setIsOpen}
    >
      <>
        <GenericDialog.Header
          title={headerTitle}
          onClickClose={cancelAction}
        ></GenericDialog.Header>
        <GenericDialog.Body>
          <>
            <Text className={styles.title}>{dialogTitle}</Text>

            <Text>{dialogMessage}</Text>
          </>
        </GenericDialog.Body>
        <GenericDialog.Actions>
          <>
            <Button type={ButtonType.Tertiary} onClick={cancelAction}>
              {dialogCancelButtonLabel}
            </Button>
            <Button
              type={ButtonType.Warning}
              onClick={confirmAction}
              loading={isLoading}
            >
              {dialogConfirmButtonLabel}
            </Button>
          </>
        </GenericDialog.Actions>
      </>
    </GenericDialog>
  );
};

export default ConfirmActionDialog;
