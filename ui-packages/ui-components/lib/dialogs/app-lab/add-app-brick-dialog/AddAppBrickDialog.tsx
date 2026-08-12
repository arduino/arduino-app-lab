import { ChevronRight } from '@cloud-editor-mono/images/assets/icons';
import {
  BrickDetails,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import {
  BrickDetail,
  BrickDetailLogic,
  BrickIcon,
  BricksList,
  Button,
  ButtonVariant,
  ConfigureAppBrickDialog,
  ConfigureAppBrickDialogLogic,
  XSmall,
  XXSmall,
} from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { addAppBrickDialogMessages as messages } from '../messages';
import styles from './add-app-brick-dialog.module.scss';
import {
  CustomBrickDialog,
  CustomBrickDialogLogic,
} from './sub-components/CustomBrickDialog';

export type AddAppBrickDialogLogic = () => {
  open: boolean;
  appId: string;
  bricks: BrickListItem[];
  appBricks: BrickInstance[] | undefined;
  loadBrickDetails: (brickId: string) => Promise<BrickDetails>;
  brickDetailLogic: BrickDetailLogic;
  configureDialogLogic: ConfigureAppBrickDialogLogic;
  confirmAddAppBrick: (brickId: string, modelId?: string) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  createAppBrickDialogLogic: CustomBrickDialogLogic;
  openCreateAppBrickDialog: () => void;
  createAppBrickDialogOpen: boolean;
  onOpenExternal: (url: string) => void;
};

type AddAppBrickDialogProps = { logic: AddAppBrickDialogLogic };

export const AddAppBrickDialog: React.FC<AddAppBrickDialogProps> = ({
  logic,
}: AddAppBrickDialogProps) => {
  const {
    open,
    appId,
    bricks,
    appBricks,
    brickDetailLogic,
    configureDialogLogic,
    onOpenChange,
    loadBrickDetails,
    confirmAddAppBrick,
    createAppBrickDialogLogic,
    openCreateAppBrickDialog,
    createAppBrickDialogOpen,
    onOpenExternal,
  } = logic();
  const [loading, setLoading] = useState(false);
  const [selectedBrick, setSelectedBrick] = useState<BrickListItem>();
  const [brickDetails, setBrickDetails] = useState<BrickDetails>();
  const [succeeded, setSucceeded] = useState(false);
  const [selectedModelByBrickId, setSelectedModelsByBrickId] = useState(
    {} as { [brickId: string]: string },
  );

  const closeDialog = (): void => {
    // Only request the close here. The dialog plays a 0.25s close animation and
    // stays mounted until it finishes; resetting the view state synchronously
    // would revert the success view to the brick list mid-animation, flashing
    // the brick manager on the way out. Transient state is instead reset when
    // the dialog (re)opens, below.
    onOpenChange(false);
  };

  useEffect(() => {
    const newlySelectedBrick = bricks.find((brick) =>
      appBricks?.every((it) => it.id !== brick.id),
    );
    setSelectedBrick(newlySelectedBrick);
  }, [appBricks, bricks, open]);

  useLayoutEffect(() => {
    if (open) {
      setSucceeded(false);
      setBrickDetails(undefined);
      setSelectedModelsByBrickId({});
    }
  }, [open]);

  const { formatMessage } = useI18n();

  const handleAddAppBrick = async (): Promise<void> => {
    if (!selectedBrick?.id) return;
    setLoading(true);
    const success = await confirmAddAppBrick(
      selectedBrick.id,
      selectedModelByBrickId[selectedBrick.id],
    );
    if (!success) {
      setLoading(false);
      return;
    }

    const brickDetails = await loadBrickDetails(selectedBrick.id!);
    if ((brickDetails.config_variables ?? []).some((v) => v.required)) {
      setBrickDetails(brickDetails);
    }
    setSucceeded(success);
    setLoading(false);
  };

  const selectedModelChange = useCallback(
    (modelId: string) => {
      if (!selectedBrick?.id) {
        return;
      }

      setSelectedModelsByBrickId((prev) => ({
        ...prev,
        [selectedBrick.id!]: modelId,
      }));
    },
    [selectedBrick],
  );

  const customBrickBanner = !succeeded ? (
    <button
      className={styles['custom-brick-banner']}
      onClick={openCreateAppBrickDialog}
    >
      <div className={styles['custom-brick-banner-content']}>
        <div className={styles['custom-brick-banner-icon']}>
          <BrickIcon />
        </div>
        <div className={styles['custom-brick-banner-texts']}>
          <XSmall className={styles['custom-brick-banner-title']}>
            {formatMessage(messages.createCustomBrickTitle)}
          </XSmall>
          <XXSmall className={styles['custom-brick-banner-subtitle']}>
            {formatMessage(messages.createCustomBrickSubtitle)}
          </XXSmall>
        </div>
      </div>

      <div className={styles['custom-brick-banner-arrow']}>
        <ChevronRight />
      </div>
    </button>
  ) : undefined;

  return brickDetails ? (
    <ConfigureAppBrickDialog
      open={true}
      setOpen={(): void => setBrickDetails(undefined)}
      appId={appId}
      brickId={brickDetails.id}
      logic={configureDialogLogic}
      onOpenExternal={onOpenExternal}
    />
  ) : (
    <>
      {!createAppBrickDialogOpen ? (
        <AppLabDialog
          open={open}
          onOpenChange={(open): void =>
            open ? onOpenChange(open) : closeDialog()
          }
          title={formatMessage(
            succeeded ? messages.successTitle : messages.dialogTitle,
          )}
          onSubmit={succeeded ? closeDialog : handleAddAppBrick}
          footer={
            succeeded ? (
              <Button
                variant={ButtonVariant.Primary}
                type="submit"
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus
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
                  variant={ButtonVariant.Secondary}
                  onClick={closeDialog}
                  classes={{
                    button: styles['action-button'],
                    textButtonText: styles['action-button-text'],
                  }}
                >
                  {formatMessage(messages.cancelButton)}
                </Button>
                <Button
                  variant={ButtonVariant.Primary}
                  loading={loading}
                  disabled={appBricks?.some(
                    (appBrick) => appBrick.id === selectedBrick?.id,
                  )}
                  type="submit"
                  /* eslint-disable-next-line jsx-a11y/no-autofocus */
                  autoFocus
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
          bottomExtension={customBrickBanner}
          classes={{
            root: clsx(styles['root'], {
              [styles['large']]: !succeeded,
            }),
            content: styles['content'],
            body: clsx(styles['body'], {
              [styles['succeeded']]: succeeded,
              [styles['bricks']]: !succeeded,
            }),
            footer: succeeded ? undefined : styles['bricks-footer'],
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
            <div className={styles['container']}>
              <div className={styles['split']}>
                <div
                  className={clsx(
                    styles['split-item'],
                    styles['split-item-left'],
                  )}
                >
                  <BricksList
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
                  className={clsx(
                    styles['split-item'],
                    styles['split-item-right'],
                  )}
                >
                  <BrickDetail
                    brickId={selectedBrick?.id ?? ''}
                    brickDetailLogic={brickDetailLogic}
                    preSelectedModelId={
                      selectedModelByBrickId[selectedBrick?.id ?? '']
                    }
                    preSelectedModelChange={selectedModelChange}
                    hideExampleHeader
                  />
                </div>
              </div>
            </div>
          )}
        </AppLabDialog>
      ) : (
        <CustomBrickDialog logic={createAppBrickDialogLogic} />
      )}
    </>
  );
};
