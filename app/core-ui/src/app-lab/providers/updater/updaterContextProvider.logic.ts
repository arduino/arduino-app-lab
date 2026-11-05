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
import {
  BoardUpdateLog,
  BoardUpdateProgress,
} from '@cloud-editor-mono/infrastructure';
import {
  UpdaterStatus,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { NetworkContext } from '../network/networkContext';
import { updaterMessages as messages } from './messages';

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
  boardUpdateProgress: number | undefined; //Completion percentage of the running board update, undefined until the first progress event
  checkForUpdates: (silent?: boolean) => Promise<void>;
  startUpdate: () => void;
  skipUpdate: () => void;
  bypassSkipUpdate: boolean;
  setStatus: (s: UpdaterStatus) => void;
  setBoardLogs: (logs: string[]) => void;
};

const UPDATE_IN_PROGRESS = 'OPERATION_IN_PROGRESS';
// The text of `ErrUpdateInProgress` in standalone-apps/app-lab-desktop/internal/update/update.go.
const APP_UPDATE_IN_PROGRESS = 'an App Lab update is already in progress';
const UPDATE_FLOW_STATUSES = [
  UpdaterStatus.UpdatingBoard,
  UpdaterStatus.UpdatingApp,
  UpdaterStatus.Restarting,
];
export const useUpdater: UseUpdater = (): ReturnType<UseUpdater> => {
  const { formatMessage } = useI18n();
  const [status, setStatusState] = useState<UpdaterStatus>(UpdaterStatus.None);
  // `checkForUpdates` reads it after awaiting the checks, when its own `status` can be stale.
  // It is written with the state, not in an effect: an answer can land before the effect runs.
  const statusRef = useRef(status);
  const _setStatus = useCallback((s: UpdaterStatus): void => {
    statusRef.current = s;
    setStatusState(s);
  }, []);
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
  const [boardUpdateProgress, setBoardUpdateProgress] = useState<number>();
  const [boardUpdateSucceeded, setBoardUpdateSucceeded] =
    useState<boolean>(false);
  const [appUpdateSucceeded, setAppUpdateSucceeded] = useState<boolean>(false);

  const logsStreamAbortController = useRef<AbortController>();

  const boardUpdateDoneFired = useRef<boolean | null>(false);
  // Set once a board update flow has completed. `restarting`, `done`, a repeated
  // `done` and a second log stream can each report the end of one flow.
  const boardUpdateDoneHandled = useRef(false);
  // Identifies the current flow, so the reconnect loop and the apply request of an
  // earlier flow cannot act on a retry.
  const boardUpdateFlowId = useRef(0);
  const appUpdateInFlight = useRef(false);

  // The provider is mounted once per session, so every new flow must reset the refs.
  const beginBoardUpdateFlow = useCallback((): void => {
    boardUpdateFlowId.current += 1;
    boardUpdateDoneFired.current = false;
    boardUpdateDoneHandled.current = false;
  }, []);

  const updateInDevMode = isFFEnabled('UPDATE_IN_DEV_MODE');

  const { data: currentAppVersion } = useQuery({
    queryKey: ['current-app-version'],

    queryFn: () => getCurrentVersion(),
  });

  const canStartUpdate =
    !!isConnected &&
    !!boardIsReachable &&
    (Config.MODE !== 'development' || updateInDevMode);

  const skipUpdate = useCallback((): void => {
    _setStatus(UpdaterStatus.Skipped);
  }, [_setStatus]);

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

  const {
    data: boardUpdates,
    dataUpdatedAt: boardUpdatesUpdatedAt,
    isFetching: isCheckingForBoardUpdates,
    refetch: checkBoardUpdateQuery,
  } = useQuery({
    queryKey: [BoardScopedQuery.BOARD_UPDATE_CHECK],
    queryFn: () => checkBoardUpdate(true),

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

    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,

    // linear retry for 2 minutes, 2 seconds delay
    retry: (counter, error) =>
      (error as Error | undefined)?.message.includes(UPDATE_IN_PROGRESS)
        ? false
        : counter < 60,

    retryDelay: 2000,
  });

  // Every check has to fetch the notes again, and `dataUpdatedAt` is the only
  // value a re-check changes: the query never goes stale, so a second check
  // returning the same updates keeps `boardUpdates` referentially equal.
  useEffect(() => {
    if (boardUpdates) {
      const newAppVersion = boardUpdates?.find(
        (update) => update.name === 'arduino-app-lab',
      )?.toVersion;
      if (isBoard && newAppVersion) {
        checkReleaseNotes(newAppVersion);
      }
    }
  }, [boardUpdates, boardUpdatesUpdatedAt, isBoard, checkReleaseNotes]);

  const {
    data: newAppVersion,
    dataUpdatedAt: newAppVersionUpdatedAt,
    isFetching: isCheckingForAppUpdates,
    refetch: checkAppUpdateQuery,
  } = useQuery({
    queryKey: ['app-update-check'],
    queryFn: newVersion,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (newAppVersion) {
      checkReleaseNotes(newAppVersion);
    }
  }, [newAppVersion, newAppVersionUpdatedAt, checkReleaseNotes]);

  const pushBoardLog = useCallback((log: string | string[]): void => {
    _setBoardLogs((prev) => prev.concat(log));
  }, []);

  const startAppUpdate = useCallback(async (): Promise<void> => {
    if (appUpdateInFlight.current) return;
    appUpdateInFlight.current = true;

    try {
      _setStatus(UpdaterStatus.UpdatingApp);
      // The App Lab update doesn't report progress: drop whatever the board
      // update left behind rather than showing a stale percentage.
      setBoardUpdateProgress(undefined);
      pushBoardLog('Starting App Lab update...');

      await checkAndApplyUpdate();
      setAppUpdateSucceeded(true);

      // TODO: when manual restart is supported for App Lab update, set status to UpdateComplete here
      // UpdaterStatus.Restarting will become obsolete
      _setStatus(UpdaterStatus.Restarting);
    } catch (err) {
      console.debug('App Lab update failed', err);
      const reason = err instanceof Error ? err.message : String(err);
      if (reason === APP_UPDATE_IN_PROGRESS) {
        // The first update outlived a reload of this page and may be replacing the app now.
        pushBoardLog(formatMessage(messages.appUpdateAlreadyRunning));
      } else {
        pushBoardLog(
          reason
            ? formatMessage(messages.appUpdateFailedWithReason, { reason })
            : formatMessage(messages.appUpdateFailed),
        );
      }

      _setStatus(UpdaterStatus.UpdateFailed);
    } finally {
      appUpdateInFlight.current = false;
    }
  }, [_setStatus, formatMessage, pushBoardLog]);

  const onBoardUpdateDone = useCallback((): void => {
    if (boardUpdateDoneHandled.current) return;
    boardUpdateDoneHandled.current = true;

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
  }, [_setStatus, isBoard, newAppVersion, pushBoardLog, startAppUpdate]);

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

  const onProgressReceived = useCallback((log: BoardUpdateLog) => {
    try {
      const { progress } = JSON.parse(log.data) as BoardUpdateProgress;
      if (typeof progress !== 'number' || Number.isNaN(progress)) {
        console.error('Unexpected update progress payload', log);
        return;
      }
      // Follow the stream instead of latching the highest value seen: a bar
      // going backwards is a backend fault worth surfacing, not hiding.
      setBoardUpdateProgress(Math.min(100, Math.max(0, Math.round(progress))));
    } catch {
      console.error('Error parsing update progress', log);
    }
  }, []);

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

          if (log.event === 'progress') {
            // Progress is drawn on the bar, never printed: it would otherwise
            // reach the log panel as a pretty-printed JSON blob.
            onProgressReceived(log);
            return;
          }

          onLogReceived(log);

          if (log.event === 'restarting') {
            boardUpdateDoneFired.current = true;
            const flowId = boardUpdateFlowId.current;
            // A `done` event can complete the flow while this loop waits, and a retry
            // can start a new one.
            const flowEnded = (): boolean =>
              boardUpdateDoneHandled.current ||
              flowId !== boardUpdateFlowId.current;
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            (async () => {
              if (flowEnded()) return;
              pushBoardLog('Reconnecting to board...');
              // After restarting event, wait before polling the orchestrator
              // Current version might not shutdown instantly
              await new Promise((res) => setTimeout(res, 5000));

              for (let attempts = 0; attempts < 10; attempts++) {
                if (flowEnded()) return;
                try {
                  const version = await getVersion();
                  if (flowEnded()) return;
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
              if (flowEnded()) return;
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
  }, [
    _setStatus,
    abortStream,
    isBoard,
    onBoardUpdateDone,
    onLogReceived,
    onProgressReceived,
    pushBoardLog,
  ]);

  const { refetch: getMandatoryUpdatesList } = useQuery({
    queryKey: ['mandatory-updates-list'],
    queryFn: getMandatoryUpdatesListApi,
    enabled: false,
  });

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
      if (isCheckingForBoardUpdates || isCheckingForAppUpdates) return;

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
        const boardErrorMessage = (boardResult.error as Error | undefined)
          ?.message;

        if (boardErrorMessage?.includes(UPDATE_IN_PROGRESS)) {
          if (statusRef.current === UpdaterStatus.UpdateComplete) {
            // The frontend cannot tell this answer from a stale one about the flow that
            // just completed. Joining it would reset the refs, and a stream that then
            // closes without `done` would report the completed update as failed.
            if (boardUpdateDoneHandled.current) return;
            // The reconnect loop gave up without `done`, so the board may still be
            // updating. Listen for its `done` with the refs and the result as they are:
            // a stream that closes without `done` then leaves the result in place.
            listenBoardUpdateLogs();
            return;
          }
          // During a flow this is a second stream of the same update: keep its refs.
          if (!UPDATE_FLOW_STATUSES.includes(statusRef.current)) {
            beginBoardUpdateFlow();
          }
          _setStatus(UpdaterStatus.UpdatingBoard);
          listenBoardUpdateLogs();
          return;
        }

        if (silent) return;

        _setStatus(UpdaterStatus.CheckingFailed);

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
      _setStatus,
      beginBoardUpdateFlow,
      checkAppUpdateQuery,
      checkBoardUpdateQuery,
      checkMandatoryUpdates,
      isBoard,
      isCheckingForAppUpdates,
      isCheckingForBoardUpdates,
      listenBoardUpdateLogs,
      pushBoardLog,
      status,
    ],
  );

  const startBoardUpdate = useCallback(async (): Promise<void> => {
    _setStatus(UpdaterStatus.UpdatingBoard);
    // A retry starts indeterminate again, until the first progress event.
    setBoardUpdateProgress(undefined);
    beginBoardUpdateFlow();
    const flowId = boardUpdateFlowId.current;
    pushBoardLog('Starting board update...');

    try {
      listenBoardUpdateLogs();
      await applyBoardUpdate(true);
    } catch {
      // The request can fail after `done`, when the daemon restarts before it answers.
      if (
        flowId === boardUpdateFlowId.current &&
        !boardUpdateDoneHandled.current
      ) {
        _setStatus(UpdaterStatus.UpdateFailed);
      }
    }
  }, [_setStatus, beginBoardUpdateFlow, listenBoardUpdateLogs, pushBoardLog]);

  const startUpdate = useCallback((): void => {
    if (boardUpdates) {
      startBoardUpdate();
    } else if (newAppVersion) {
      startAppUpdate();
    } else {
      console.error('startUpdate called but no updates are available');
      _setStatus(UpdaterStatus.AlreadyUpToDate);
    }
  }, [
    _setStatus,
    boardUpdates,
    newAppVersion,
    startAppUpdate,
    startBoardUpdate,
  ]);

  useEffect(() => {
    if (status === UpdaterStatus.UpdateFailed) {
      abortStream();
    }
  }, [abortStream, status]);

  const setStatus = useCallback(
    (s: UpdaterStatus) => {
      _setStatus(s);
    },
    [_setStatus],
  );

  const setBoardLogs = useCallback((logs: string[]) => {
    _setBoardLogs(logs);
  }, []);

  return useMemo(
    () => ({
      status,
      boardUpdateSucceeded,
      appUpdateSucceeded,
      boardUpdates,
      currentAppVersion,
      newAppVersion,
      releaseNotes,
      boardLogs,
      boardUpdateProgress,
      checkForUpdates,
      startUpdate,
      canStartUpdate,
      skipUpdate,
      bypassSkipUpdate,
      setStatus,
      setBoardLogs,
    }),
    [
      appUpdateSucceeded,
      boardLogs,
      boardUpdateProgress,
      boardUpdateSucceeded,
      boardUpdates,
      bypassSkipUpdate,
      canStartUpdate,
      checkForUpdates,
      currentAppVersion,
      newAppVersion,
      releaseNotes,
      setBoardLogs,
      setStatus,
      skipUpdate,
      startUpdate,
      status,
    ],
  );
};
