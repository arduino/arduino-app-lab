import {
  Rhomboid,
  Success,
  TriangleSharpOutline,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  MarkdownReader,
  Medium,
  useI18n,
  XSmall,
  XXSmall,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './board-update-dialog.module.scss';
import {
  BoardUpdateDialogProps,
  UpdaterStatus,
} from './BoardUpdateDialog.type';
import { messages } from './messages';

export const BoardUpdateDialog: React.FC<BoardUpdateDialogProps> = ({
  logic,
}: BoardUpdateDialogProps) => {
  const { formatMessage } = useI18n();
  const [showDetails, setShowDetails] = useState(true);

  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const {
    board,
    open,
    status,
    newAppVersion,
    releaseNotes,
    boardUpdates,
    boardUpdateSucceeded,
    appUpdateSucceeded,
    boardLogs,
    startUpdate,
    reloadApp,
    skipUpdate,
    changeNetwork,
    openFlasherTool,
    openArduinoSupport,
    bypassSkipUpdate,
  } = logic();

  useEffect(() => {
    setShowDetails(releaseNotes === undefined);
  }, [releaseNotes]);

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      const el = logsContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [boardLogs, autoScroll]);

  const handleLogsScroll = (): void => {
    if (!logsContainerRef.current) return;

    const el = logsContainerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 5;

    setAutoScroll(isAtBottom);
  };

  return (
    <AppLabDialog
      open={open}
      closeable={false}
      disableAutoFocus
      classes={{
        body: clsx(styles['dialog-body'], {
          [styles['checking']]: status === UpdaterStatus.Checking,
        }),
      }}
    >
      {status === UpdaterStatus.Checking ? (
        <div className={styles['checking-updates']}>
          <div className={styles['spinner']} />
          <Medium>{formatMessage(messages.checkingForUpdates)}</Medium>
          <XSmall>
            {formatMessage(messages.checkingForUpdatesDescription)}
          </XSmall>
        </div>
      ) : (
        <>
          <div className={styles['update-dialog-header']}>
            <XXSmall className={styles['title']}>
              {formatMessage(messages.title)}
            </XXSmall>
            {!bypassSkipUpdate && status === UpdaterStatus.UpdateAvailable && (
              <Button
                variant={ButtonVariant.Tertiary}
                size={ButtonSize.XSmall}
                onClick={skipUpdate}
              >
                {formatMessage(messages.skipUpdate)}
              </Button>
            )}
          </div>
          <div className={styles['update-dialog-body']}>
            {status === UpdaterStatus.CheckingFailed ? (
              <div className={styles['checking-failed']}>
                <div className={styles['checking-failed--icon']}>
                  <TriangleSharpOutline />
                </div>
                <h3>{formatMessage(messages.checkingFailed)}</h3>
                <span className={styles['checking-failed--description']}>
                  {formatMessage(messages.checkingFailedDescription)}{' '}
                  <button
                    type="button"
                    onClick={openFlasherTool}
                    className={styles['link']}
                  >
                    {formatMessage(messages.arduinoFlasherTool)}
                  </button>{' '}
                  {formatMessage(messages.orContact)}{' '}
                  <button
                    type="button"
                    className={styles['link']}
                    onClick={openArduinoSupport}
                  >
                    {formatMessage(messages.arduinoSupport)}
                  </button>
                </span>
              </div>
            ) : (
              <>
                {!showDetails && releaseNotes && (
                  <div className={styles['release-notes']}>
                    <img src={releaseNotes.image} alt="Release notes" />
                    <div className={styles['notes']}>
                      <MarkdownReader content={releaseNotes.content} />
                    </div>
                  </div>
                )}

                {releaseNotes && (
                  <div
                    className={clsx(styles['update-details'], {
                      [styles['visible']]: showDetails,
                    })}
                  >
                    <Button
                      variant={ButtonVariant.Tertiary}
                      size={ButtonSize.XSmall}
                      appearance={ButtonAppearance.LowContrast}
                      onClick={(): void => setShowDetails((prev) => !prev)}
                    >
                      {formatMessage(
                        showDetails
                          ? messages.hideDetails
                          : messages.showDetails,
                      )}
                    </Button>
                  </div>
                )}

                {showDetails && (
                  <div className={styles['update-available']}>
                    {boardUpdates && boardUpdates.length > 0 && (
                      <div>
                        <div className={styles['update-available-header']}>
                          <Rhomboid />
                          <span
                            className={styles['update-available-header--title']}
                          >
                            {formatMessage(messages.softwareUpdate, {
                              boardModel: board?.type.toUpperCase(),
                            })}
                          </span>
                          {status === UpdaterStatus.UpdatingBoard && (
                            <div
                              className={
                                styles['update-available-header--status']
                              }
                            >
                              <div className={styles['spinner-small']} />
                              {formatMessage(messages.installing)}
                            </div>
                          )}
                          {boardUpdateSucceeded && (
                            <div
                              className={
                                styles['update-available-header--status']
                              }
                            >
                              <Success />
                              {formatMessage(messages.installed)}
                            </div>
                          )}
                        </div>
                        <ul className={styles['update-available--list']}>
                          {boardUpdates.map((update) => (
                            <li key={update.name}>
                              <b>{update.name}</b>{' '}
                              <span
                                className={styles['update-available-version']}
                              >
                                {formatMessage(messages.version)}{' '}
                                {update.toVersion}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {newAppVersion && (
                      <div className={styles['update-available-header']}>
                        <Rhomboid />
                        <span
                          className={styles['update-available-header--title']}
                        >
                          {formatMessage(messages.arduinoAppLab)}
                        </span>
                        <span className={styles['update-available-version']}>
                          {formatMessage(messages.version)} {newAppVersion}
                        </span>
                        {status === UpdaterStatus.UpdatingApp && (
                          <div
                            className={
                              styles['update-available-header--status']
                            }
                          >
                            <div className={styles['spinner-small']} />
                            {formatMessage(messages.installing)}
                          </div>
                        )}
                        {appUpdateSucceeded && (
                          <div
                            className={
                              styles['update-available-header--status']
                            }
                          >
                            <Success />
                            {formatMessage(messages.installed)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {(showDetails || status === UpdaterStatus.CheckingFailed) && (
              <div
                ref={logsContainerRef}
                className={clsx(styles['update-logs'], {
                  [styles['success']]: status === UpdaterStatus.UpdateComplete,
                  [styles['error']]: [
                    UpdaterStatus.CheckingFailed,
                    UpdaterStatus.UpdateFailed,
                  ].includes(status),
                })}
                onScroll={handleLogsScroll}
              >
                {boardLogs?.map((log, index) => (
                  <XXSmall key={index} className={styles['log-entry']}>
                    {log}
                  </XXSmall>
                ))}
              </div>
            )}

            <div
              className={clsx(styles['update-footer'], {
                [styles['expanded']]:
                  showDetails || status === UpdaterStatus.CheckingFailed,
                [styles['available']]: status === UpdaterStatus.UpdateAvailable,
                [styles['installing']]: [
                  UpdaterStatus.UpdatingApp,
                  UpdaterStatus.UpdatingBoard,
                ].includes(status),
                [styles['completed']]: status === UpdaterStatus.UpdateComplete,
                [styles['failed']]: [
                  UpdaterStatus.UpdateFailed,
                  UpdaterStatus.CheckingFailed,
                ].includes(status),
              })}
            >
              {status === UpdaterStatus.CheckingFailed && (
                <>
                  <div className={styles['error']}>
                    <TriangleSharpOutline />
                    <XXXSmall>{formatMessage(messages.updateFailed)}</XXXSmall>
                  </div>
                  <div className={styles['checking-failed-actions']}>
                    <Button
                      variant={ButtonVariant.Secondary}
                      size={ButtonSize.XSmall}
                      onClick={changeNetwork}
                    >
                      {formatMessage(messages.changeNetwork)}
                    </Button>
                    <Button
                      variant={ButtonVariant.Primary}
                      size={ButtonSize.XSmall}
                      onClick={skipUpdate}
                    >
                      {formatMessage(messages.skipUpdate)}
                    </Button>
                  </div>
                </>
              )}

              {status === UpdaterStatus.UpdateAvailable && (
                <Button
                  variant={ButtonVariant.Primary}
                  size={ButtonSize.XSmall}
                  onClick={startUpdate}
                >
                  {formatMessage(messages.installUpdate)}
                </Button>
              )}

              {[
                UpdaterStatus.UpdatingApp,
                UpdaterStatus.UpdatingBoard,
              ].includes(status) && (
                <>
                  <div className={styles['infinite-indicator']}>
                    <div className={styles['indicator']} />
                  </div>
                  <div className={styles['progress']}>
                    <div className={styles['spinner-small']} />
                    <XXXSmall>
                      {formatMessage(messages.updateInstalling)}
                    </XXXSmall>
                  </div>
                </>
              )}

              {status === UpdaterStatus.UpdateComplete && (
                <>
                  <div className={styles['success']}>
                    <Success />
                    <XXXSmall>
                      {formatMessage(messages.updateCompleted)}
                    </XXXSmall>
                  </div>
                  <Button
                    variant={ButtonVariant.Primary}
                    size={ButtonSize.XSmall}
                    onClick={reloadApp}
                  >
                    {formatMessage(messages.restart)}
                  </Button>
                </>
              )}

              {status === UpdaterStatus.UpdateFailed && (
                <>
                  <div className={styles['error']}>
                    <TriangleSharpOutline />
                    <XXXSmall>{formatMessage(messages.updateFailed)}</XXXSmall>
                  </div>
                  <Button
                    variant={ButtonVariant.Primary}
                    size={ButtonSize.XSmall}
                    onClick={startUpdate}
                  >
                    {formatMessage(messages.retry)}
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AppLabDialog>
  );
};
