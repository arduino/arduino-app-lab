import {
  chooseReleaseSavePath,
  getReleaseBuildEvents,
  prepareApp,
  startReleaseBuild as startReleaseBuildRequest,
  writeReleaseFile,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { AppRelease, Bell, Stop } from '@cloud-editor-mono/images/assets/icons';
import {
  CreateReleaseRequest,
  createUUID,
  EventSourceHandlers,
  SERVER_CLOSED_ERROR_CODE,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import {
  BannerAction,
  BannerProps,
  BuildLogLine,
  Notification,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQueryClient } from '@tanstack/react-query';
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { sendAppLabNotification } from '../../features/notifications';
import { releaseMessages } from '../../features/release/messages';
import { useFooterNotifications } from '../footer-notifications/footerNotificationsContext';

interface BuildJob {
  buildId: string;
  appId: string;
  releaseName: string;
  step?: string;
  progress?: number;
  // Set while the create-release form is held open over the copy step; the corner card skips the job.
  blocking: boolean;
}

interface PrepareJob {
  appId: string;
  appName: string;
  progress?: number;
}

// The form blocks the App during this step: a release built from files still being edited ships a half-written App.
const BLOCKING_STEP = 'copying the app';
const DOWNLOAD_STEP = 'archive';

// The build stream opens before the build starts, because the daemon replays
// nothing to a late subscriber. A stream that never answers must not block the
// build for good.
const STREAM_OPEN_TIMEOUT_MS = 3000;

const MAX_LOG_LINES = 2000;

const buildNotificationId = (buildId: string): string =>
  `release-build-${buildId}`;
const prepareNotificationId = (appId: string): string =>
  `release-prepare-${appId}`;

type StreamPayload = {
  build_id?: string;
  name?: string;
  progress?: number;
  message?: string;
  code?: string;
};

export interface StartReleaseBuildParams {
  appId: string;
  releaseName: string;
  fileName: string;
  body: CreateReleaseRequest;
}

export interface PreparationCallbacks {
  // For the caller that was about to start the App.
  onPrepared?: () => void;
  // Replaces the default success notification.
  successMessage?: string;
}

export type UseRelease = () => {
  // Resolves when the copy step is over, not when the whole release is: the
  // caller holds its dialog open for exactly as long as this takes.
  startReleaseBuild: (params: StartReleaseBuildParams) => Promise<void>;
  isBuildingApp: (appId: string) => boolean;
  startPreparation: (
    appId: string,
    appName: string,
    callbacks?: PreparationCallbacks,
  ) => void;
  bannerProps: BannerProps[];
  // The log of a failed build, shown in the build log dialog while set.
  buildLog?: BuildLogLine[];
  setBuildLog: (log?: BuildLogLine[]) => void;
};

const clampProgress = (progress?: number): number | undefined =>
  progress != null ? Math.min(100, Math.round(progress)) : undefined;

const parsePayload = (data: string): StreamPayload | undefined => {
  // `close` carries an empty payload, and an unknown event may not be JSON.
  if (!data) return undefined;
  try {
    return JSON.parse(data);
  } catch (parseError) {
    console.warn(parseError);
    return undefined;
  }
};

type ListedNotification = Notification & { id: string };

// A hidden job is listed in the notifications panel until it ends or its card is shown again.
// An entry is added once: progress events change the job, not its entry.
const useListedNotifications = (listed: ListedNotification[]): void => {
  const { setNotification, removeNotification } = useFooterNotifications();
  const shown = useRef(new Set<string>());
  useEffect(() => {
    const listedIds = new Set(listed.map((notification) => notification.id));
    shown.current.forEach((id) => {
      if (listedIds.has(id)) return;
      removeNotification(id);
      shown.current.delete(id);
    });
    listed.forEach((notification) => {
      if (shown.current.has(notification.id)) return;
      shown.current.add(notification.id);
      setNotification(notification);
    });
  }, [listed, removeNotification, setNotification]);
};

export const useRelease: UseRelease = () => {
  const { formatMessage } = useI18n();
  const queryClient = useQueryClient();

  const [builds, setBuilds] = useState<BuildJob[]>([]);
  const [prepares, setPrepares] = useState<PrepareJob[]>([]);
  const [buildsHidden, setBuildsHidden] = useState(false);
  const [preparesHidden, setPreparesHidden] = useState(false);
  const [buildLog, setBuildLog] = useState<BuildLogLine[]>();

  // `stop` ends a build without reporting it: its requests still settle after that, and must not report it again.
  const jobs = useRef(
    new Map<
      string,
      {
        onEvent: (event: string, payload: StreamPayload) => void;
        stop: () => void;
      }
    >(),
  );
  const buildStream = useRef<{
    abortController: AbortController;
    ready: Promise<void>;
  } | null>(null);
  const prepareAborts = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const aborts = prepareAborts.current;
    const running = jobs.current;
    return (): void => {
      buildStream.current?.abortController.abort();
      aborts.forEach((abortController) => abortController.abort());
      running.forEach((job) => job.stop());
    };
  }, []);

  const updateBuild = useCallback(
    (buildId: string, update: Partial<BuildJob>) =>
      setBuilds((current) =>
        current.map((job) =>
          job.buildId === buildId ? { ...job, ...update } : job,
        ),
      ),
    [],
  );

  const openBuildStream = useCallback((): Promise<void> => {
    if (buildStream.current) return buildStream.current.ready;

    const abortController = new AbortController();
    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    const timeout = setTimeout(markReady, STREAM_OPEN_TIMEOUT_MS);

    const handlers: EventSourceHandlers = {
      onopen: async (): Promise<void> => {
        clearTimeout(timeout);
        markReady();
      },
      onclose: undefined,
      onerror: undefined,
      onmessage: (event) => {
        const payload = parsePayload(event.data);
        if (!payload?.build_id) return;
        jobs.current.get(payload.build_id)?.onEvent(event.event, payload);
      },
    };

    buildStream.current = { abortController, ready };
    void getReleaseBuildEvents(handlers, abortController)
      .catch((error) => console.warn('release build stream ended', error))
      .finally(() => {
        clearTimeout(timeout);
        markReady();
        if (buildStream.current?.abortController === abortController) {
          buildStream.current = null;
        }
      });

    return ready;
  }, []);

  // The shared stream closes with the last build that listens to it.
  const endBuild = useCallback((buildId: string) => {
    jobs.current.delete(buildId);
    setBuilds((current) => current.filter((job) => job.buildId !== buildId));
    if (jobs.current.size === 0) {
      buildStream.current?.abortController.abort();
      buildStream.current = null;
    }
  }, []);

  const startReleaseBuild = useCallback(
    ({
      appId,
      releaseName,
      fileName,
      body,
    }: StartReleaseBuildParams): Promise<void> =>
      new Promise<void>((resolveDialog) => {
        const buildId = createUUID();
        const abortController = new AbortController();
        let unblocked = false;
        let settled = false;
        const log: BuildLogLine[] = [];
        const appendLog = (line: BuildLogLine): void => {
          log.push(line);
          if (log.length > MAX_LOG_LINES) log.shift();
        };

        setBuildsHidden(false);
        setBuilds((current) => [
          ...current,
          { buildId, appId, releaseName, blocking: true },
        ]);

        const fail = (error?: unknown): void => {
          if (settled) return;
          if (error) {
            appendLog({
              text: error instanceof Error ? error.message : String(error),
              kind: 'error',
            });
          }
          unblock(false);
          settled = true;
          abortController.abort();
          endBuild(buildId);
          sendAppLabNotification({
            message: formatMessage(releaseMessages.buildFailed, {
              releaseName,
            }),
            variant: 'error',
            // It stays until closed: the log it opens is the only record of why.
            duration: Infinity,
            actions: [
              {
                text: formatMessage(releaseMessages.viewLog),
                onClick: ({ dismiss }): void => {
                  dismiss();
                  setBuildLog(log);
                },
              },
            ],
          });
        };

        // The daemon answers the build request with the archive once the build
        // is over. The stream is opened first: it replays nothing.
        const archive = (async (): Promise<Blob> => {
          await openBuildStream();
          if (settled) throw new Error('The release build was stopped');
          return startReleaseBuildRequest(
            appId,
            buildId,
            body,
            abortController,
          );
        })();
        archive.then(
          () => unblock(true),
          (error: unknown) => fail(error),
        );

        // The native dialog opens once the copy is done. The archive is written
        // when both the path and the build are there.
        const save = (): void => {
          void (async (): Promise<void> => {
            const filePath = await chooseReleaseSavePath(fileName);
            if (settled) return;
            if (!filePath) {
              // A closed dialog stops the build, which is what the user asked.
              settled = true;
              abortController.abort();
              endBuild(buildId);
              return;
            }
            const content = await archive;
            if (settled) return;
            await writeReleaseFile(filePath, content);
            settled = true;
            endBuild(buildId);
            sendAppLabNotification({
              message: formatMessage(releaseMessages.buildCompleted, {
                releaseName,
              }),
              variant: 'success',
            });
          })().catch((error: unknown) => fail(error));
        };

        // The copy is over at the first step after it, at `done`, or when the
        // archive arrives, whichever the daemon sends first.
        const unblock = (andSave: boolean): void => {
          if (unblocked || settled) return;
          unblocked = true;
          updateBuild(buildId, { blocking: false });
          resolveDialog();
          if (andSave) save();
        };

        const onEvent = (event: string, payload: StreamPayload): void => {
          switch (event) {
            case StreamEventType.Progress: {
              updateBuild(buildId, {
                step: payload.name || undefined,
                progress: clampProgress(payload.progress),
              });
              if (payload.name && payload.name !== BLOCKING_STEP) {
                unblock(true);
              }
              break;
            }
            case StreamEventType.Message:
              if (payload.message) {
                appendLog({ text: payload.message, kind: 'info' });
              }
              break;
            case StreamEventType.Done:
              updateBuild(buildId, { step: DOWNLOAD_STEP, progress: 100 });
              unblock(true);
              break;
            case StreamEventType.Error:
              fail(payload.message || payload.code || '');
              break;
            default:
              break;
          }
        };
        jobs.current.set(buildId, {
          onEvent,
          stop: () => {
            settled = true;
            abortController.abort();
          },
        });
      }),
    [endBuild, formatMessage, openBuildStream, updateBuild],
  );

  const stopBuild = useCallback(
    (job: BuildJob) => {
      jobs.current.get(job.buildId)?.stop();
      endBuild(job.buildId);
      sendAppLabNotification({
        message: formatMessage(releaseMessages.buildStopped, {
          releaseName: job.releaseName,
        }),
        variant: 'warning',
      });
    },
    [endBuild, formatMessage],
  );

  // Keyed on the Apps only, so progress events do not change the callback.
  const buildingAppIds = builds.map((job) => job.appId).join('\n');
  const isBuildingApp = useCallback(
    (appId: string) => buildingAppIds.split('\n').includes(appId),
    [buildingAppIds],
  );

  const startPreparation = useCallback(
    (
      appId: string,
      appName: string,
      callbacks?: PreparationCallbacks,
    ): void => {
      if (prepareAborts.current.has(appId)) return;
      const abortController = new AbortController();
      prepareAborts.current.set(appId, abortController);
      setPreparesHidden(false);
      setPrepares((current) => [...current, { appId, appName }]);

      let settled = false;
      const finish = (succeeded: boolean): void => {
        if (settled) return;
        settled = true;
        abortController.abort();
        prepareAborts.current.delete(appId);
        setPrepares((current) => current.filter((job) => job.appId !== appId));
        sendAppLabNotification({
          message: succeeded
            ? callbacks?.successMessage ??
              formatMessage(releaseMessages.prepareCompleted)
            : formatMessage(releaseMessages.prepareFailed, { appName }),
          variant: succeeded ? 'success' : 'error',
        });
        // Preparation downloads the models, and a failed one may have
        // downloaded some before it stopped.
        void queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.GET_INSTALLED_MODELS],
        });
        void queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.GET_BRICK_DETAILS],
        });
        if (succeeded) {
          callbacks?.onPrepared?.();
        }
      };

      const handlers: EventSourceHandlers = {
        onopen: undefined,
        onclose: undefined,
        onerror: undefined,
        onmessage: (event) => {
          const payload = parsePayload(event.data);
          if (!payload) return;
          switch (event.event) {
            case StreamEventType.Progress:
              if (payload.progress == null) break;
              setPrepares((current) =>
                current.map((job) =>
                  job.appId === appId
                    ? { ...job, progress: clampProgress(payload.progress) }
                    : job,
                ),
              );
              break;
            case StreamEventType.Done:
              finish(true);
              break;
            case StreamEventType.Error:
              // The server closes every stream with its own error, `done` or not.
              if (payload.code === SERVER_CLOSED_ERROR_CODE) break;
              console.warn('release preparation failed', payload);
              finish(false);
              break;
            default:
              break;
          }
        },
      };

      const onEnd = (): void => {
        if (!abortController.signal.aborted) finish(false);
      };
      void prepareApp(appId, handlers, abortController).then(onEnd, onEnd);
    },
    [formatMessage, queryClient],
  );

  const hideAction = useCallback(
    (onSelect: () => void): BannerAction => ({
      id: 'hide',
      label: formatMessage(releaseMessages.actionHide),
      labelPrefix: createElement(Bell),
      onSelect,
    }),
    [formatMessage],
  );

  const buildNotifications = useMemo(
    (): ListedNotification[] =>
      buildsHidden
        ? builds
            .filter((job) => !job.blocking)
            .map((job) => ({
              id: buildNotificationId(job.buildId),
              label: formatMessage(releaseMessages.notificationSaving, {
                releaseName: job.releaseName,
              }),
              icon: createElement(AppRelease),
              onClick: () => setBuildsHidden(false),
            }))
        : [],
    [builds, buildsHidden, formatMessage],
  );
  useListedNotifications(buildNotifications);

  const prepareNotifications = useMemo(
    (): ListedNotification[] =>
      preparesHidden
        ? prepares.map((job) => ({
            id: prepareNotificationId(job.appId),
            label: formatMessage(releaseMessages.bannerPreparingTitle, {
              count: 1,
              appName: job.appName,
            }),
            icon: createElement(AppRelease),
            onClick: () => setPreparesHidden(false),
          }))
        : [],
    [prepares, preparesHidden, formatMessage],
  );
  useListedNotifications(prepareNotifications);

  const buildBanner = useMemo((): BannerProps | null => {
    const visible = builds.filter((job) => !job.blocking);
    if (buildsHidden || visible.length === 0) return null;

    const actions: BannerAction[] = [
      ...visible.map((job) => ({
        id: `stop-${job.buildId}`,
        label: formatMessage(releaseMessages.actionStop, {
          releaseName: job.releaseName,
        }),
        labelPrefix: createElement(Stop),
        truncateLabel: true,
        danger: true,
        onSelect: (): void => stopBuild(job),
      })),
      hideAction(() => setBuildsHidden(true)),
    ];

    return {
      type: 'operation',
      title: formatMessage(releaseMessages.bannerCreatingTitle, {
        count: visible.length,
      }),
      description: formatMessage(releaseMessages.bannerCreatingDescription),
      rows: visible.map((job) => ({
        id: job.buildId,
        label: formatMessage(
          job.step === DOWNLOAD_STEP
            ? releaseMessages.stepDownloading
            : releaseMessages.stepBuilding,
          { releaseName: job.releaseName },
        ),
        progress: job.progress,
      })),
      actions,
    };
  }, [builds, buildsHidden, formatMessage, hideAction, stopBuild]);

  const prepareBanner = useMemo((): BannerProps | null => {
    if (preparesHidden || prepares.length === 0) return null;

    return {
      type: 'operation',
      title: formatMessage(releaseMessages.bannerPreparingTitle, {
        count: prepares.length,
        appName: prepares[0].appName,
      }),
      description: formatMessage(releaseMessages.bannerPreparingDescription),
      rows: prepares.map((job) => ({
        id: job.appId,
        label: formatMessage(releaseMessages.stepPreparing),
        progress: job.progress,
      })),
      actions: [hideAction(() => setPreparesHidden(true))],
    };
  }, [prepares, preparesHidden, formatMessage, hideAction]);

  const bannerProps = useMemo(
    () =>
      [buildBanner, prepareBanner].filter(
        (banner): banner is BannerProps => banner !== null,
      ),
    [buildBanner, prepareBanner],
  );

  return {
    startReleaseBuild,
    isBuildingApp,
    startPreparation,
    bannerProps,
    buildLog,
    setBuildLog,
  };
};
