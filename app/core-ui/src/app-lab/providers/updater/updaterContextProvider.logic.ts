import { Config } from '@cloud-editor-mono/common';
import {
  applyBoardUpdate,
  checkAndApplyUpdate,
  checkBoardUpdate,
  getBoardUpdateLogs,
  getCurrentVersion,
  getMandatoryUpdatesList as getMandatoryUpdatesListApi,
  getReleaseImageSrc,
  getReleaseNotes,
  getVersion,
  isFFEnabled,
  newVersion,
  reloadApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { BoardUpdateLog } from '@cloud-editor-mono/infrastructure';
import { UpdaterStatus } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useIsBoard } from '../../hooks/useIsBoard';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { NetworkContext } from '../network/networkContext';

export type UseUpdater = () => {
  canStartUpdate: boolean;
  status: UpdaterStatus;
  boardUpdateSucceeded: boolean;
  appUpdateSucceeded: boolean;
  boardUpdates: Array<{ name: string; toVersion: string }> | null | undefined; //This is the update: version pair
  currentAppVersion: string | undefined; //This is the current version of the arduino app lab (on PC)
  newAppVersion: string | undefined; //This is the arduino app lab (on PC)
  releaseNotes: { content: string; image: string } | undefined;
  boardLogs: string[];
  checkForUpdates: (silent?: boolean) => Promise<void>;
  startUpdate: () => void;
  skipUpdate: () => void;
  bypassSkipUpdate: boolean;
  setStatus: (s: UpdaterStatus) => void;
  setBoardLogs: (logs: string[]) => void;
};

export const useUpdater: UseUpdater = (): ReturnType<UseUpdater> => {
  const [status, _setStatus] = useState<UpdaterStatus>(UpdaterStatus.None);
  const [bypassSkipUpdate, setBypassSkipUpdate] = useState<boolean>(false);
  const [releaseNotes, setReleaseNotes] = useState<{
    content: string;
    image: string;
  }>();

  const { data: isBoard } = useIsBoard();

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const { isConnected } = useContext(NetworkContext);

  const [boardLogs, _setBoardLogs] = useState<string[]>([]);
  const [boardUpdateSucceeded, setBoardUpdateSucceeded] =
    useState<boolean>(false);
  const [appUpdateSucceeded, setAppUpdateSucceeded] = useState<boolean>(false);

  const logsStreamAbortController = useRef<AbortController>();

  const boardUpdateDoneFired = useRef<boolean | null>(false);

  const updateInDevMode = isFFEnabled('UPDATE_IN_DEV_MODE');

  const { data: currentAppVersion } = useQuery(['current-app-version'], () =>
    getCurrentVersion(),
  );

  const canStartUpdate =
    !!isConnected &&
    !!boardIsReachable &&
    (Config.MODE !== 'development' || updateInDevMode);

  const skipUpdate = useCallback((): void => {
    _setStatus(UpdaterStatus.Skipped);
  }, []);

  const checkReleaseNotes = useCallback(async (newAppVersion: string) => {
    try {
      const response = await getReleaseNotes(newAppVersion);
      setReleaseNotes({
        content: response,
        image: getReleaseImageSrc(newAppVersion),
      });
    } catch (e) {
      console.error('Error fetching release notes', e);
      setReleaseNotes(undefined);
    }
  }, []);

  const { data: boardUpdates, refetch: checkBoardUpdateQuery } = useQuery(
    ['board-update-check'],
    () => checkBoardUpdate(true),
    {
      select: (data) => {
        if (data.updates && data.updates.length > 0) {
          return data.updates.map((update) => ({
            name: update.name || 'Unknown',
            toVersion: update.to_version || '',
          }));
        }
        // null = no board updates available
        return null;
      },
      onSuccess: (data) => {
        const newAppVersion = data?.find(
          (update) => update.name === 'arduino-app-lab',
        )?.toVersion;
        if (isBoard && newAppVersion) {
          checkReleaseNotes(newAppVersion);
        }
      },
      enabled: false,
      staleTime: Infinity,
      cacheTime: Infinity,
      // linear retry for 2 minutes, 2 seconds delay
      retry: Math.floor((120 * 1000) / 2000),
      retryDelay: 2000,
    },
  );

  const { data: newAppVersion, refetch: checkAppUpdateQuery } = useQuery(
    ['app-update-check'],
    newVersion,
    {
      onSuccess: checkReleaseNotes,
      enabled: false,
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  );

  const pushBoardLog = useCallback((log: string | string[]): void => {
    _setBoardLogs((prev) => prev.concat(log));
  }, []);

  const startAppUpdate = useCallback(async (): Promise<void> => {
    try {
      _setStatus(UpdaterStatus.UpdatingApp);
      pushBoardLog('Starting App Lab update...');

      await checkAndApplyUpdate();
      setAppUpdateSucceeded(true);

      // TODO: when manual restart is supported for App Lab update, set status to UpdateComplete here
      // UpdaterStatus.Restarting will become obsolete
      _setStatus(UpdaterStatus.Restarting);
    } catch (err) {
      console.debug('App Lab update failed', err);
      pushBoardLog('App Lab update failed');

      _setStatus(UpdaterStatus.UpdateFailed);
    }
  }, [pushBoardLog]);

  const onBoardUpdateDone = useCallback((): void => {
    pushBoardLog('Board update completed successfully.');
    setBoardUpdateSucceeded(true);

    if (newAppVersion) {
      startAppUpdate();
      return;
    }

    if (isBoard) {
      pushBoardLog('App Lab needs to be manually restarted.');
    }

    _setStatus(UpdaterStatus.UpdateComplete);
  }, [isBoard, newAppVersion, pushBoardLog, startAppUpdate]);

  const onLogReceived = useCallback(
    (log: BoardUpdateLog) => {
      try {
        const parsed = JSON.parse(log.data);
        const message =
          typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
        pushBoardLog(message);
      } catch {
        console.error('Error parsing update log', log);
      }
    },
    [pushBoardLog],
  );

  const abortStream = useCallback((): void => {
    if (logsStreamAbortController.current) {
      logsStreamAbortController.current.abort();
      logsStreamAbortController.current = undefined;
    }
  }, []);

  const listenBoardUpdateLogs = useCallback((): Promise<void> => {
    logsStreamAbortController.current = new AbortController();
    return getBoardUpdateLogs(
      {
        onopen: async (_) => {
          console.debug('Board update log stream opened');
        },
        onmessage: (resp) => {
          console.debug('Board update log', resp);
          const log = resp as BoardUpdateLog;
          onLogReceived(log);

          if (log.event === 'restarting') {
            boardUpdateDoneFired.current = true;
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            (async () => {
              pushBoardLog('Reconnecting to board...');
              // After restarting event, wait before polling the orchestrator
              // Current version might not shutdown instantly
              await new Promise((res) => setTimeout(res, 5000));

              for (let attempts = 0; attempts < 10; attempts++) {
                try {
                  const version = await getVersion();
                  console.debug('Got orchestrator version', version);
                  if (version) {
                    pushBoardLog('Connection established');
                    onBoardUpdateDone();
                    return;
                  }
                } catch (err) {
                  console.debug('Get orchestrator version error', err);
                }
                await new Promise((res) => setTimeout(res, 1500));
              }
              console.debug(
                'Failed to pool for orchestrator version after update',
              );

              // Here we assume the update was successful
              // After an update from R0, tunnel connection drops even after a successful update
              _setStatus(UpdaterStatus.UpdateComplete);

              // On desktop app a reload is needed to re-establish tunnel
              pushBoardLog(
                'Failed to reconnect to board after update. Reloading app...',
              );
              setTimeout(() => {
                if (isBoard) {
                  reloadApp();
                }
              }, 3000);

              // TODO: this should be triggered when App Lab update support manual reload
              // onBoardUpdateDone();
            })();
          }

          if (log.event === 'done') {
            boardUpdateDoneFired.current = true;
            onBoardUpdateDone();
          }

          if (log.event === 'close') {
            if (!boardUpdateDoneFired) {
              _setStatus(UpdaterStatus.UpdateFailed);
              abortStream();
            }
          }
        },
        onclose: () => {
          console.debug('Board update log stream closed');
          setTimeout(() => {
            if (!boardUpdateDoneFired.current) {
              _setStatus(UpdaterStatus.UpdateFailed);
            }
          }, 1500);
        },
        onerror: (error) => {
          console.debug('Board update log stream error:', error);
          try {
            const errorLog = `Log stream error: ${JSON.stringify(error)}`;
            pushBoardLog(errorLog);
            setTimeout(() => {
              if (!boardUpdateDoneFired.current) {
                _setStatus(UpdaterStatus.UpdateFailed);
              }
            }, 1500);
          } catch (e) {
            console.error('Error parsing log stream error', e);
          }
        },
      },
      logsStreamAbortController.current,
    );
  }, [abortStream, isBoard, onBoardUpdateDone, onLogReceived, pushBoardLog]);

  const { refetch: getMandatoryUpdatesList } = useQuery(
    ['mandatory-updates-list'],
    getMandatoryUpdatesListApi,
    {
      enabled: false,
    },
  );

  const checkMandatoryUpdates = useCallback(
    async (
      boardUpdates:
        | {
            name: string;
            toVersion: string;
          }[]
        | null,
      appUpdateVersion: string | null,
    ): Promise<void> => {
      let mandatoryUpdateList = null;
      let updateIsMandatory = false;
      try {
        mandatoryUpdateList = (await getMandatoryUpdatesList()).data;

        const boardUpdateIsMandatory =
          !!mandatoryUpdateList &&
          !!boardUpdates &&
          !!mandatoryUpdateList.find((i) =>
            boardUpdates.some(
              (update) =>
                i.pkgName === update.name && i.version === update.toVersion,
            ),
          );

        const appUpdateIsMandatory =
          !!mandatoryUpdateList &&
          !!appUpdateVersion &&
          !!mandatoryUpdateList.some(
            (i) =>
              i.pkgName === 'arduino-app-lab' && i.version === appUpdateVersion,
          );

        updateIsMandatory = boardUpdateIsMandatory || appUpdateIsMandatory;
      } catch (e) {
        updateIsMandatory = true;
        console.error('Failed to get mandatory updates list:', e);
      }

      if (updateIsMandatory) {
        setBypassSkipUpdate(true);
      }
    },
    [getMandatoryUpdatesList],
  );

  const checkForUpdates = useCallback(
    async (silent = false): Promise<void> => {
      if (!silent && status === UpdaterStatus.Skipped) {
        return;
      }

      if (!silent) {
        _setStatus(UpdaterStatus.Checking);
      }

      const [boardResult, appResult] = await Promise.all([
        checkBoardUpdateQuery(),
        !isBoard ? checkAppUpdateQuery() : Promise.resolve(null),
      ]);

      if (boardResult.error || (appResult && appResult.error)) {
        if (silent) return;

        _setStatus(UpdaterStatus.CheckingFailed);

        const boardErrorMessage = (boardResult.error as Error | undefined)
          ?.message;
        const boardErrorDetail =
          !!boardResult.error &&
          `Board update error${
            boardErrorMessage ? `: ${boardErrorMessage}` : ''
          }`;
        if (boardErrorDetail) {
          pushBoardLog(boardErrorDetail);
        }

        const appErrorDetail =
          !!appResult && appResult.error ? `App Lab update error` : '';
        if (appErrorDetail) {
          pushBoardLog(appErrorDetail);
        }

        return;
      }

      const boardHasUpdate = !!boardResult && !!boardResult.data;
      const appHasUpdate = !!appResult && !!appResult.data;

      if (boardHasUpdate || appHasUpdate) {
        await checkMandatoryUpdates(
          boardResult.data || null,
          appResult?.data || null,
        );
        if (!silent) {
          _setStatus(UpdaterStatus.UpdateAvailable);
        }
        return;
      }

      if (!silent) {
        _setStatus(UpdaterStatus.AlreadyUpToDate);
      }
    },
    [
      checkAppUpdateQuery,
      checkBoardUpdateQuery,
      checkMandatoryUpdates,
      isBoard,
      pushBoardLog,
      status,
    ],
  );

  const startBoardUpdate = useCallback(async (): Promise<void> => {
    _setStatus(UpdaterStatus.UpdatingBoard);
    pushBoardLog('Starting board update...');

    try {
      listenBoardUpdateLogs();
      await applyBoardUpdate(true);
    } catch {
      _setStatus(UpdaterStatus.UpdateFailed);
    }
  }, [listenBoardUpdateLogs, pushBoardLog]);

  const startUpdate = useCallback((): void => {
    if (boardUpdates) {
      startBoardUpdate();
    } else if (newAppVersion) {
      startAppUpdate();
    } else {
      console.error('startUpdate called but no updates are available');
      _setStatus(UpdaterStatus.AlreadyUpToDate);
    }
  }, [boardUpdates, newAppVersion, startAppUpdate, startBoardUpdate]);

  useEffect(() => {
    if (status === UpdaterStatus.UpdateFailed) {
      abortStream();
    }
  }, [abortStream, status]);

  const setStatus = useCallback((s: UpdaterStatus) => {
    _setStatus(s);
  }, []);

  const setBoardLogs = useCallback((logs: string[]) => {
    _setBoardLogs(logs);
  }, []);

  return {
    status,
    boardUpdateSucceeded,
    appUpdateSucceeded,
    boardUpdates,
    currentAppVersion,
    newAppVersion,
    releaseNotes,
    boardLogs,
    checkForUpdates,
    startUpdate,
    canStartUpdate,
    skipUpdate,
    bypassSkipUpdate,
    setStatus,
    setBoardLogs,
  };
};
