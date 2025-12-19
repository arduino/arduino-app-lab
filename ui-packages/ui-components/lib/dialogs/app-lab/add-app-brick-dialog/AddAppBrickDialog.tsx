import {
  BrickDetails,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { BrickDetailLogic } from '../../../app-lab-brick-detail';
import BrickDetail from '../../../app-lab-brick-detail/BrickDetail';
import { AppLabBricksList } from '../../../app-lab-bricks-list';
import {
  Button,
  ButtonType,
  ConfigureAppBrickDialog,
  ConfigureAppBrickDialogLogic,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { addAppBrickDialogMessages as messages } from '../messages';
import styles from './add-app-brick-dialog.module.scss';

export type AddAppBrickDialogLogic = () => {
  appBricks: BrickInstance[] | undefined;
  bricks: BrickListItem[];
  open: boolean;
  brickDetailLogic: BrickDetailLogic;
  confirmAction: (brick: BrickListItem) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
};

type AddAppBrickDialogProps = { logic: AddAppBrickDialogLogic };

export const AddAppBrickDialog: React.FC<AddAppBrickDialogProps> = ({
  logic,
}: AddAppBrickDialogProps) => {
  const {
    appBricks,
    bricks,
    open,
    brickDetailLogic,
    confirmAction,
    onOpenChange,
  } = logic();
  const [loading, setLoading] = useState(false);
  const [selectedBrick, setSelectedBrick] = useState<BrickListItem>();
  const [brickDetails, setBrickDetails] = useState<BrickDetails>();
  const [succeeded, setSucceeded] = useState(false);

  const closeDialog = (): void => {
    onOpenChange(false);
    setSucceeded(false);
    setBrickDetails(undefined);
  };

  useEffect(() => {
    setSelectedBrick(
      bricks.find((brick) => appBricks?.every((it) => it.id !== brick.id)),
    );
  }, [appBricks, bricks, open]);

  const { formatMessage } = useI18n();
  const { loadBrickDetails, loadBrickInstance, updateBrickDetails } =
    brickDetailLogic();

  const handleConfirm = async (): Promise<void> => {
    if (!selectedBrick) return;
    setLoading(true);
    const success = await confirmAction(selectedBrick);
    if (!success) {
      setLoading(false);
      return;
    }

    const brickDetails = await loadBrickDetails(selectedBrick.id!);
    if (
      (brickDetails.config_variables ?? []).some((v) => v.required) ||
      brickDetails.require_model
    ) {
      setBrickDetails(brickDetails);
    }
    setSucceeded(success);
    setLoading(false);
  };

  const configureLogic: ConfigureAppBrickDialogLogic | null = useMemo(
    () =>
      brickDetails && loadBrickInstance && updateBrickDetails
        ? (): ReturnType<ConfigureAppBrickDialogLogic> => ({
            brick: brickDetails,
            open: true,
            loadBrickInstance,
            onOpenChange: (): void => setBrickDetails(undefined),
            confirmAction: updateBrickDetails,
          })
        : null,
    [brickDetails, loadBrickInstance, updateBrickDetails],
  );

  return configureLogic ? (
    <ConfigureAppBrickDialog logic={configureLogic} />
  ) : (
    <AppLabDialog
      open={open}
      onOpenChange={(open): void => (open ? onOpenChange(open) : closeDialog())}
      title={formatMessage(
        succeeded ? messages.successTitle : messages.dialogTitle,
      )}
      footer={
        succeeded ? (
          <Button
            type={ButtonType.Primary}
            onClick={closeDialog}
            classes={{
              button: styles['action-button'],
              textButtonText: styles['action-button-text'],
            }}
          >
            {formatMessage(messages.checkButton)}
          </Button>
        ) : (
          <>
            <Button
              type={ButtonType.Secondary}
              onClick={closeDialog}
              classes={{
                button: styles['action-button'],
                textButtonText: styles['action-button-text'],
              }}
            >
              {formatMessage(messages.cancelButton)}
            </Button>
            <Button
              type={ButtonType.Primary}
              loading={loading}
              disabled={appBricks?.some(
                (appBrick) => appBrick.id === selectedBrick?.id,
              )}
              onClick={handleConfirm}
              classes={{
                button: styles['action-button'],
                textButtonText: styles['action-button-text'],
              }}
            >
              {formatMessage(messages.confirmButton)}
            </Button>
          </>
        )
      }
      classes={{
        root: clsx(styles['root'], {
          [styles['large']]: !succeeded,
        }),
        content: styles['content'],
        body: clsx(styles['body'], {
          [styles['succeeded']]: succeeded,
        }),
      }}
    >
      {succeeded ? (
        <div className={styles['success-container']}>
          <p className={styles['success-description']}>
            {formatMessage(messages.successDescription)}
          </p>
          <ol className={styles['success-steps']}>
            <li className={styles['success-step']}>
              {formatMessage(messages.successStep1, {
                bold: (chunks: string) => <b>{chunks}</b>,
              })}
            </li>
            <li className={styles['success-step']}>
              {formatMessage(messages.successStep2, {
                bold: (chunks: string) => <b>{chunks}</b>,
              })}
            </li>
          </ol>
        </div>
      ) : (
        <div className={styles['split']}>
          <div className={(styles['split-item'], styles['split-item-left'])}>
            <AppLabBricksList
              bricks={bricks}
              disabledBricks={bricks.filter((brick) =>
                appBricks?.some((appBrick) => appBrick.id === brick.id),
              )}
              selectedBrick={selectedBrick}
              brickSize="medium"
              expanded={false}
              onClick={setSelectedBrick}
              classes={{
                container: styles['bricks-list-container'],
                item: styles['brick-item'],
                itemSelected: styles['selected'],
                itemTitle: styles['brick-item-title'],
              }}
            />
          </div>

          <div
            className={clsx(styles['split-item'], styles['split-item-right'])}
          >
            <BrickDetail
              brickId={selectedBrick?.id ?? ''}
              brickDetailLogic={brickDetailLogic}
            />
          </div>
        </div>
      )}
    </AppLabDialog>
  );
};
