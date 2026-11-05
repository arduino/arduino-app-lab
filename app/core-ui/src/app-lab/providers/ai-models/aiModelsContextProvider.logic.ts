import {
  Config,
  EI_LATENCY_DEVICE,
  EI_LATENCY_DEVICE_BY_FQBN,
} from '@cloud-editor-mono/common';
import {
  downloadAIModel,
  getEIProjects,
  installAIModel,
  installEIModel,
  isEIDeploymentOutdated,
  openLinkExternal,
  setEILatencyDevice,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { Ai as AiIcon } from '@cloud-editor-mono/images/assets/icons';
import {
  AIModelItem,
  EIProject,
  EventSourceHandlers,
  isUnsupportedEndpointError,
  SERVER_CLOSED_ERROR_CODE,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import {
  ModelDownloadInfo,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MessageDescriptor } from 'react-intl';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { sendAppLabNotification } from '../../features/notifications';
import { useInstalledAIModels } from '../../hooks/useInstalledAIModels';
import { get, set } from '../../services/persistentStore';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { plainModelId } from '../../utils/modelId';
import { EdgeImpulseContext } from '../edge-impulse/edgeImpulseContext';
import { useFooterNotifications } from '../footer-notifications/footerNotificationsContext';
import {
  AiModelsContextValue,
  DownloadAIModelSSEOptions,
} from './aiModelsContext';
import { aiModelsMessages as messages } from './messages';
import { parseSseEvent } from './parse-sse-event/parseSseEvent';
import { isCompatibleEICategory } from './utils';

export type UseEdgeImpulseParams = {
  enabled?: boolean;
};
const CHECK_STORAGE_KEY = 'ei_project_association_check_performed';

const ERROR_CODE_MESSAGES = new Map<string, MessageDescriptor>([
  ['insufficient_storage', messages.insufficientStorage],
  ['invalid_model_url', messages.invalidModelUrl],
  ['model_not_found', messages.modelNotFound],
  ['model_private_or_gated', messages.modelPrivateOrGated],
  ['model_disabled', messages.modelDisabled],
  ['model_incompatible', messages.modelIncompatible],
  ['no_compatible_file', messages.noCompatibleFile],
  ['hub_unreachable', messages.hubUnreachable],
]);

// The install route's `source` is a model id the board declares, so the listing
// already holds an entry for it. The download route's is a Hugging Face source,
// and the id it installs under is unknown until the `done` event.
type ModelStreamOptions = DownloadAIModelSSEOptions & {
  declaredModelId?: string;
};

export function useAiModelsLogic(
  _params: UseEdgeImpulseParams = {},
): AiModelsContextValue {
  const [enableEdgeImpulseAutoRefresh, setEnableEdgeImpulseAutoRefresh] =
    useState(false);

  const [currentDownloads, setCurrentDownloads] = useState<{
    [projectId: string]: ModelDownloadInfo;
  } | null>(null);

  const { isAuthenticated } = useContext(EdgeImpulseContext);

  const { formatMessage } = useI18n();
  const { setNotification } = useFooterNotifications();
  const navigate = useNavigate();

  const selectedConnectedBoard = useBoardLifecycleStore(
    (state) => state.selectedConnectedBoard,
  );

  const queryClient = useQueryClient();

  const [qBoardProjects, setQBoardProjects] = useState<EIProject[]>([]);
  const { data: projects } = useQuery({
    queryKey: ['edge-impulse-projects', isAuthenticated],
    queryFn: getEIProjects,
    enabled: enableEdgeImpulseAutoRefresh && isAuthenticated,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    setQBoardProjects(projects?.filter((p) => p.hasQBoardLatencyDevice) || []);
  }, [projects]);

  const { installedModels, getInstalledModel } = useInstalledAIModels();

  // Key the outdated-deployment check on a stable signature of the installed
  // Edge Impulse deployments (projectId, impulseId, deploymentVersion) instead
  // of the whole `projects`/`installedModels` objects. This stops the network
  // fan-out to `isEIDeploymentOutdated` from re-running on unrelated
  // `installedModels` changes (e.g. after every download) — the key only
  // changes when a deployment version actually does.
  const outdatedModelsQueryKey = useMemo(() => {
    const deploymentSignature = (projects || [])
      .flatMap((project) =>
        (project.impulses || []).map((impulse) => {
          const deploymentVersion = getInstalledModel(
            project.id.toString(),
            impulse.id.toString(),
          )?.metadata?.['ei-deployment-version'];
          return deploymentVersion
            ? `${project.id}-${impulse.id}:${deploymentVersion}`
            : undefined;
        }),
      )
      .filter(Boolean)
      .sort()
      .join('|');
    return ['outdated-models', deploymentSignature];
  }, [projects, getInstalledModel]);
  const { data: outdatedModelsLookup } = useQuery({
    queryKey: outdatedModelsQueryKey,
    queryFn: async () => {
      const deploymentsToCheck: {
        projectId: string;
        impulseId: string;
        deploymentVersion: string;
      }[] = [];
      // Get deploymentVersion from installed models that are associated with remote EI project
      for (const project of projects || []) {
        for (const impulse of project.impulses || []) {
          const deploymentVersion = getInstalledModel(
            project.id.toString(),
            impulse.id.toString(),
          )?.metadata?.['ei-deployment-version'];
          if (deploymentVersion) {
            deploymentsToCheck.push({
              projectId: project.id.toString(),
              impulseId: impulse.id.toString(),
              deploymentVersion,
            });
          }
        }
      }
      // For each deploymentVersion, check if it's outdated
      const results = await Promise.all(
        deploymentsToCheck.map(
          async ({ projectId, impulseId, deploymentVersion }) => {
            const isOutdated = await isEIDeploymentOutdated(
              projectId,
              deploymentVersion,
            );
            return { projectId, impulseId, isOutdated };
          },
        ),
      );
      // Return easy lookup of outdated deployments by projectId and deploymentVersion
      return results.reduce((lookup, { projectId, impulseId, isOutdated }) => {
        const id = `ei-model-${projectId}-${impulseId}`;
        return {
          ...lookup,
          [id]: isOutdated,
        };
      }, {} as { [key: string]: boolean });
    },
    enabled: (installedModels || []).length > 0 && (projects || []).length > 0,
  });

  const isModelOutdated = useCallback(
    (modelId: string): boolean => {
      return !!outdatedModelsLookup?.[modelId];
    },
    [outdatedModelsLookup],
  );
  const getEIProjectsByBrickType = useCallback(
    (brickType: string) => {
      return qBoardProjects.filter((p) => {
        const match = isCompatibleEICategory(brickType, p.category, p.impulses);
        return match;
      });
    },
    [qBoardProjects],
  );

  const updateDownload = (
    info: Partial<ModelDownloadInfo>,
    projectId: string,
  ): void => {
    setCurrentDownloads((prev) => ({
      ...(prev || {}),
      [projectId]: {
        ...(prev || {})[projectId],
        ...info,
      },
    }));
  };

  const clearDownload = useCallback((progressId: string): void => {
    setCurrentDownloads((prev) => {
      if (!prev?.[progressId]) {
        return prev;
      }
      // A stream replaced by a newer one for the same source resolves like any
      // other, so its caller asks for this: a record the live stream is still
      // writing to has to survive that.
      if (prev[progressId].isDownloading) {
        return prev;
      }
      const { [progressId]: _cleared, ...rest } = prev;
      return rest;
    });
  }, []);

  const setDownloadNotification = useCallback(
    (model: AIModelItem): void => {
      setNotification({
        label: formatMessage(messages.modelDownloaded, {
          name: model.name || plainModelId(model),
        }),
        tooltip: formatMessage(messages.modelDownloadedTooltip),
        icon: createElement(AiIcon),
        onClick: (): void => {
          const installed = queryClient.getQueryData<AIModelItem[]>([
            BoardScopedQuery.GET_INSTALLED_MODELS,
          ]);
          const brickId = installed?.find((m) => m.id === model.id)
            ?.brick_ids?.[0];
          navigate({
            to: '/bricks',
            search: { brickId, tab: 'aiModels' },
          });
        },
      });
    },
    [formatMessage, navigate, queryClient, setNotification],
  );

  const downloadImpulse = useCallback(
    async (projectId: string, impulseId: string): Promise<AIModelItem> => {
      if (currentDownloads?.[projectId]?.isDownloading) {
        throw Error('Already downloading a model from this project');
      }

      let item: AIModelItem;
      try {
        updateDownload(
          {
            error: false,
            success: false,
            isDownloading: true,
          },
          projectId,
        );
        item = await installEIModel(projectId, impulseId);
        const itemId = item.id || `ei-model-${projectId}-${impulseId}`;
        // The outdated-deployment lookup is keyed by the plain id, the form the
        // impulse rows carry.
        const plainId = item.id ? plainModelId(item) : itemId;
        queryClient.setQueryData(
          [BoardScopedQuery.GET_INSTALLED_MODELS],
          (prev: AIModelItem[] | undefined) => {
            let found = false;
            const next = (prev || []).map((m) => {
              if (m.id === itemId) {
                found = true;
                return item;
              }
              return m;
            });
            return found ? next : (prev || []).concat(item);
          },
        );
        updateDownload({ isDownloading: false, success: true }, projectId);
        // Align with the generic download flow: post a footer notification for
        // account-linked Edge Impulse installs too.
        setDownloadNotification(item);
        queryClient.setQueryData(
          outdatedModelsQueryKey,
          (prev: { [key: string]: boolean } | undefined) => ({
            ...prev,
            [plainId]: false,
          }),
        );
      } catch (error: unknown) {
        if (error instanceof Error) {
          sendAppLabNotification({
            message: error.message,
            variant: 'error',
          });
        } else {
          console.error(error);
        }
        updateDownload({ isDownloading: false, error: true }, projectId);

        return Promise.reject(error);
      }

      return item;
    },
    [
      currentDownloads,
      outdatedModelsQueryKey,
      queryClient,
      setDownloadNotification,
    ],
  );

  const { mutate: openAndAssociateToDevice } = useMutation({
    mutationFn: async () => {
      const alreadyChecked = await get(CHECK_STORAGE_KEY);

      const url = `${Config.EI_STUDIO_HOST}?defaultIdps=arduino`; // `defaultIdps=arduino` shows "login with Arduino"

      const freshEiProjects = projects || (await getEIProjects()); // fetch in case above query not yet loaded

      if (freshEiProjects?.length !== 1 || alreadyChecked) {
        openLinkExternal(url);
        return;
      }

      const project = freshEiProjects[0];

      const createdDate = project.created
        ? new Date(project.created)
        : new Date(0);
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      if (
        createdDate < twoHoursAgo ||
        project.hasQBoardLatencyDevice ||
        project.hasOtherNonDefaultLatencyDevice ||
        !project.id
      ) {
        openLinkExternal(url);
        return;
      }

      const latencyDevice = selectedConnectedBoard?.fqbn
        ? EI_LATENCY_DEVICE_BY_FQBN[selectedConnectedBoard.fqbn] ??
          EI_LATENCY_DEVICE.UNO_Q
        : EI_LATENCY_DEVICE.UNO_Q;

      await setEILatencyDevice(project.id.toString(), latencyDevice);
      openLinkExternal(url);
    },

    onSuccess: async () => {
      await set(CHECK_STORAGE_KEY, true);
    },
  });

  // Keyed by the `modelId` passed to `runModelStream`, so concurrent downloads
  // each match their own SSE events.
  const downloadStreamsRef = useRef<
    Map<string, { abortController: AbortController }>
  >(new Map());

  const runModelStream = useCallback(
    async (
      source: string,
      startStream: (
        handlers: EventSourceHandlers,
        abortController: AbortController,
      ) => Promise<void>,
      options: ModelStreamOptions = {},
    ): Promise<AIModelItem | undefined> => {
      const {
        progressKey,
        linkedBrickId,
        onStarted,
        onError,
        declaredModelId,
      } = options;

      const progressId = progressKey ?? source;

      downloadStreamsRef.current.get(source)?.abortController.abort();

      const abortController = new AbortController();
      downloadStreamsRef.current.set(source, { abortController });

      let installedModel: AIModelItem | undefined;
      let downloadSucceeded = false;
      let started = false;
      let failure: Error | undefined;
      let fileName: string | undefined;

      const hasNewerStream = (): boolean => {
        const current = downloadStreamsRef.current.get(source);
        return !!current && current.abortController !== abortController;
      };

      const cleanup = (): void => {
        if (!hasNewerStream()) {
          downloadStreamsRef.current.delete(source);
        }
      };

      updateDownload(
        {
          isDownloading: true,
          error: false,
          success: false,
          percentage: 0,
        },
        progressId,
      );

      const notifyStarted = (): void => {
        if (started) {
          return;
        }
        started = true;
        // Name the brick only once the download is real: a source that turns out
        // not to exist has to leave the model list untouched.
        if (linkedBrickId) {
          updateDownload({ linkedBrickId }, progressId);
        }
        onStarted?.();
      };

      const reportFailure = (error: Error): void => {
        if (isUnsupportedEndpointError(error)) {
          sendAppLabNotification({
            message: formatMessage(messages.updateAppLab),
            variant: 'info',
            actions: [
              {
                text: formatMessage(messages.goToSettings),
                onClick: () => navigate({ to: '/settings' }),
              },
            ],
          });
        } else if (started || !onError) {
          sendAppLabNotification({
            message: error.message,
            variant: 'error',
          });
        }
        if (!started) {
          onError?.(error);
        }
      };

      // A daemon older than the one-endpoint API answers `done` with a log line
      // and never the model, so a stream can end with the install finished and
      // nothing to complete it from. An install names a declared id the listing
      // already holds an entry for; a Hugging Face source names no entry.
      const installedFromListing = (
        modelId: string | undefined,
      ): AIModelItem | undefined => {
        const declared = modelId
          ? queryClient
              .getQueryData<AIModelItem[]>([
                BoardScopedQuery.GET_INSTALLED_MODELS,
              ])
              ?.find((m) => m.id === modelId)
          : undefined;
        return declared && { ...declared, status: 'installed' };
      };

      const completeDownload = (model?: AIModelItem): boolean => {
        if (downloadSucceeded) {
          return true;
        }
        const completed = model ?? installedFromListing(declaredModelId);
        if (!completed) {
          return false;
        }
        downloadSucceeded = true;
        const modelId = completed.id;
        installedModel = completed;
        updateDownload(
          {
            isDownloading: false,
            error: false,
            success: true,
            percentage: 100,
          },
          progressId,
        );
        const name = completed.name || plainModelId(completed);
        // A Hugging Face URL and a key can name the same file, and the SSE
        // answers `done` for a file it already has without downloading it again.
        if (getInstalledModel(modelId)?.status === 'installed') {
          sendAppLabNotification({
            message: formatMessage(messages.modelAlreadyInstalled, { name }),
            variant: 'info',
          });
        } else {
          setDownloadNotification(completed);
          sendAppLabNotification({
            message: formatMessage(messages.modelDownloaded, { name }),
            variant: 'success',
          });
        }

        queryClient.setQueryData(
          [BoardScopedQuery.GET_INSTALLED_MODELS],
          (prev: AIModelItem[] | undefined) => {
            const models = prev || [];
            return models.some((m) => m.id === modelId)
              ? models.map((m) =>
                  m.id === modelId ? { ...m, ...completed } : m,
                )
              : models.concat(completed);
          },
        );
        return true;
      };

      const handlers: EventSourceHandlers = {
        onopen: undefined,
        onclose: cleanup,
        onerror: undefined,
        onmessage: (event: EventSourceMessage) => {
          const streamEvent = parseSseEvent(event);
          if (!streamEvent) {
            return;
          }

          switch (streamEvent.event) {
            case StreamEventType.Error: {
              // A normal end-of-stream is signalled as a SERVER_CLOSED error.
              if (streamEvent.code === SERVER_CLOSED_ERROR_CODE) {
                break;
              }
              if (hasNewerStream()) {
                break;
              }
              const codeMessage = streamEvent.code
                ? ERROR_CODE_MESSAGES.get(streamEvent.code)
                : undefined;
              failure = new Error(
                codeMessage
                  ? formatMessage(codeMessage)
                  : streamEvent.message ||
                    formatMessage(messages.downloadFailed),
              );

              updateDownload(
                {
                  isDownloading: false,
                  error: true,
                  success: false,
                  percentage: 0,
                },
                progressId,
              );
              break;
            }
            case StreamEventType.Done:
              completeDownload(streamEvent.model);
              break;
            case StreamEventType.Progress:
              notifyStarted();
              fileName = fileName ?? streamEvent.name;
              updateDownload(
                { percentage: streamEvent.progress, fileName },
                progressId,
              );
              break;
            case StreamEventType.Message:
              break;
            default:
              break;
          }
        },
      };

      try {
        await startStream(handlers, abortController);
        if (!downloadSucceeded && !failure && !hasNewerStream()) {
          if (!completeDownload()) {
            failure = new Error(
              formatMessage(messages.downloadEndedUnexpectedly),
            );
            updateDownload(
              { isDownloading: false, success: false, percentage: 0 },
              progressId,
            );
          }
        }
      } catch (error: unknown) {
        if (!hasNewerStream()) {
          failure = isUnsupportedEndpointError(error)
            ? error
            : new Error(
                error instanceof Error
                  ? formatMessage(messages.downloadFailedWithReason, {
                      reason: error.message,
                    })
                  : formatMessage(messages.downloadFailed),
              );
          updateDownload(
            {
              isDownloading: false,
              error: true,
              success: false,
              percentage: 0,
            },
            progressId,
          );
        }
        downloadSucceeded = false;
      } finally {
        cleanup();
      }

      if (failure && !downloadSucceeded) {
        // in case of any other error, we want to invalidate the whole set of
        // installed models query so that the user can retry the download
        queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.GET_INSTALLED_MODELS],
        });
        reportFailure(failure);
      }

      if (!failure && !hasNewerStream()) {
        notifyStarted();
      }

      return installedModel;
    },
    [
      formatMessage,
      getInstalledModel,
      navigate,
      queryClient,
      setDownloadNotification,
    ],
  );

  // Installs a model the board's list declares — PUT /v1/models/{id}.
  const installAIModelSSE = useCallback(
    (
      declaredId: string,
      options?: DownloadAIModelSSEOptions,
    ): Promise<AIModelItem | undefined> =>
      runModelStream(
        declaredId,
        (handlers, abortController) =>
          installAIModel(declaredId, handlers, abortController),
        { ...options, declaredModelId: declaredId },
      ),
    [runModelStream],
  );

  // Downloads a model the board's list does not declare, from a Hugging Face
  // source — POST /v1/models.
  const downloadAIModelSSE = useCallback(
    (
      source: string,
      options?: DownloadAIModelSSEOptions & { mmprojUrl?: string },
    ): Promise<AIModelItem | undefined> =>
      runModelStream(
        source,
        (handlers, abortController) =>
          downloadAIModel(
            source,
            handlers,
            abortController,
            options?.mmprojUrl,
          ),
        options,
      ),
    [runModelStream],
  );

  return useMemo(
    () => ({
      currentDownloads,
      clearDownload,
      installedModels: installedModels || [],
      isModelOutdated,
      getInstalledModel,
      getEIProjectsByBrickType,
      downloadImpulse,
      enabledEIAutoRefresh: setEnableEdgeImpulseAutoRefresh,
      openAndAssociateToDevice,
      installAIModelSSE,
      downloadAIModelSSE,
    }),
    [
      currentDownloads,
      clearDownload,
      installedModels,
      isModelOutdated,
      getInstalledModel,
      getEIProjectsByBrickType,
      downloadImpulse,
      openAndAssociateToDevice,
      installAIModelSSE,
      downloadAIModelSSE,
    ],
  );
}
