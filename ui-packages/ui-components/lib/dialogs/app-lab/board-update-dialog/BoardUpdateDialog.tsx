import {
  Rhomboid,
  Success,
  TriangleSharpOutline,
} from '@cloud-editor-mono/images/assets/icons';
import { useMemo } from 'react';

import {
  Button,
  ButtonSize,
  ButtonType,
  useI18n,
} from '../../../components-by-app/app-lab';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './board-update-dialog.module.scss';
import {
  BoardUpdateDialogProps,
  UpdaterStatus,
} from './BoardUpdateDialog.type';
import { LogsPanel } from './LogsPanel';
import { messages } from './messages';

export const BoardUpdateDialog: React.FC<BoardUpdateDialogProps> = ({
  logic,
}: BoardUpdateDialogProps) => {
  const { formatMessage } = useI18n();

  const {
    open,
    isBoard,
    status,
    newAppVersion,
    boardUpdates,
    boardUpdateSucceeded,
    appUpdateSucceeded,
    boardLogs,
    boardLogErrors,
    logStatus,
    startUpdate,
    reloadApp,
    skipUpdate,
    openFlasherTool,
    openArduinoSupport,
    bypassSkipUpdate,
  } = logic();

  const title = useMemo(() => {
    switch (status) {
      case UpdaterStatus.Checking:
      case UpdaterStatus.CheckingFailed:
        return formatMessage(messages.titleCheckingForUpdates);
      case UpdaterStatus.UpdateAvailable:
        return formatMessage(messages.titleUpdatesAvailable);
      case UpdaterStatus.UpdatingBoard:
      case UpdaterStatus.UpdatingApp:
        return formatMessage(messages.titleInstallingUpdates);
      default:
        return formatMessage(messages.titleUpdates);
    }
  }, [formatMessage, status]);

  const footer = useMemo(() => {
    switch (status) {
      case UpdaterStatus.UpdateAvailable:
        return (
          <div className={styles['footer-buttons']}>
            {bypassSkipUpdate ? null : (
              <Button
                type={ButtonType.Secondary}
                size={ButtonSize.Small}
                onClick={skipUpdate}
              >
                {formatMessage(messages.skipUpdate)}
              </Button>
            )}
            <Button
              type={ButtonType.Primary}
              size={ButtonSize.Small}
              onClick={startUpdate}
            >
              {formatMessage(messages.installUpdate)}
            </Button>
          </div>
        );

      case UpdaterStatus.UpdateComplete:
      case UpdaterStatus.Restarting:
        // Hide reload button for SBC as it needs a full app restart
        return !isBoard ? (
          <Button
            classes={{ button: styles['reload-button'] }}
            type={ButtonType.Primary}
            size={ButtonSize.Small}
            loading={status === UpdaterStatus.Restarting}
            onClick={reloadApp}
          >
            {formatMessage(messages.restart)}
          </Button>
        ) : null;

      default:
        return null;
    }
  }, [formatMessage, isBoard, reloadApp, skipUpdate, startUpdate, status]);

  return (
    <AppLabDialog
      open={open}
      title={title}
      closeable={false}
      footer={footer}
      classes={{ body: styles['dialog-body'] }}
    >
      <div className={styles['update-dialog']}>
        {status === UpdaterStatus.Checking && (
          <>
            <div className={styles['spinner']} />
            <h3>{formatMessage(messages.checkingForUpdates)}</h3>
            <p>{formatMessage(messages.onlyMoment)}</p>
          </>
        )}

        {[UpdaterStatus.CheckingFailed, UpdaterStatus.UpdateFailed].includes(
          status,
        ) && (
          <div className={styles['update-failed']}>
            <div className={styles['update-failed--icon']}>
              <TriangleSharpOutline />
            </div>
            <h3>{formatMessage(messages.updateFailed)}</h3>
            <span className={styles['update-failed--description']}>
              {formatMessage(messages.updateFailedDescription)}{' '}
              <button onClick={openFlasherTool} className={styles['link']}>
                {formatMessage(messages.arduinoFlasherTool)}
              </button>{' '}
              {formatMessage(messages.orContact)}{' '}
              <button className={styles['link']} onClick={openArduinoSupport}>
                {formatMessage(messages.arduinoSupport)}
              </button>
            </span>
          </div>
        )}

        {[
          UpdaterStatus.UpdateAvailable,
          UpdaterStatus.UpdateComplete,
          UpdaterStatus.UpdatingBoard,
          UpdaterStatus.UpdatingApp,
          UpdaterStatus.Restarting,
        ].includes(status) && (
          <div className={styles['update-available']}>
            {boardUpdates && boardUpdates.length > 0 && (
              <div>
                <div className={styles['update-available-header']}>
                  <Rhomboid />
                  <span className={styles['update-available-header--title']}>
                    {formatMessage(messages.unoQSoftwareUpdate)}
                  </span>
                  {status === UpdaterStatus.UpdatingBoard && (
                    <div className={styles['update-available-header--status']}>
                      <div className={styles['spinner-small']} />
                      {formatMessage(messages.installing)}
                    </div>
                  )}
                  {boardUpdateSucceeded && (
                    <div className={styles['update-available-header--status']}>
                      <Success />
                      {formatMessage(messages.installed)}
                    </div>
                  )}
                </div>
                <ul className={styles['update-available--list']}>
                  {boardUpdates.map((update) => (
                    <li key={update.name}>
                      <b>{update.name}</b>{' '}
                      <span className={styles['update-available-version']}>
                        {formatMessage(messages.version)} {update.toVersion}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {newAppVersion && (
              <div className={styles['update-available-header']}>
                <Rhomboid />
                <span className={styles['update-available-header--title']}>
                  {formatMessage(messages.arduinoAppLab)}
                </span>
                <span className={styles['update-available-version']}>
                  {formatMessage(messages.version)} {newAppVersion}
                </span>
                {status === UpdaterStatus.UpdatingApp && (
                  <div className={styles['update-available-header--status']}>
                    <div className={styles['spinner-small']} />
                    {formatMessage(messages.installing)}
                  </div>
                )}
                {appUpdateSucceeded && (
                  <div className={styles['update-available-header--status']}>
                    <Success />
                    {formatMessage(messages.installed)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {boardLogs && boardLogs.length > 0 && (
          <LogsPanel status={logStatus} logs={boardLogs} />
        )}

        {boardLogErrors && boardLogErrors.length > 0 && (
          <div className={styles['error-logs']}>
            <p>{formatMessage(messages.errorEncountered)}:</p>
            <ul>
              {boardLogErrors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}

        {isBoard && status === UpdaterStatus.UpdateComplete && (
          <p className={styles['sbc-restart-note']}>
            {formatMessage(messages.sbcRestartNote)}
          </p>
        )}
      </div>
    </AppLabDialog>
  );
};
