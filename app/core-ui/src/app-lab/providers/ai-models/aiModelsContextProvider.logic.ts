import { Config } from '@cloud-editor-mono/common';
import {
  getAIModels,
  getEIProjects,
  installEIModel,
  isEIDeploymentOutdated,
  openLinkExternal,
  setEILatencyDevice,
  uploadAIModel,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { Ai as AiIcon } from '@cloud-editor-mono/images/assets/icons';
import {
  AIModelItem,
  EIProject,
  EventSourceHandlers,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import { ModelDownloadInfo } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { get, set } from 'idb-keyval';
import {
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// import { useNotificationsLogic } from '../../../cloud-editor/features/notifications/notifications.logic';
import { sendAppLabNotification } from '../../features/notifications';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { EdgeImpulseContext } from '../edge-impulse/edgeImpulseContext';
import { useFooterNotifications } from '../footer-notifications/footerNotificationsContext';
import { AiModelsContextValue } from './aiModelsContext';
import { isCompatibleEICategory, mapProjectToModel } from './utils';

export type UseEdgeImpulseParams = {
  enabled?: boolean;
};
const CHECK_STORAGE_KEY = 'ei_project_association_check_performed';

export function useAiModelsLogic(
  _params: UseEdgeImpulseParams = {},
): AiModelsContextValue {
  const [enableEdgeImpulseAutoRefresh, setEnableEdgeImpulseAutoRefresh] =
    useState(false);

  const [currentDownloads, setCurrentDownloads] = useState<{
    [projectId: string]: ModelDownloadInfo;
  } | null>(null);

  const { isAuthenticated } = useContext(EdgeImpulseContext);

  const { setNotification } = useFooterNotifications();
  const navigate = useNavigate();

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const queryClient = useQueryClient();

  const [unoQProjects, setUnoQProjects] = useState<EIProject[]>([]);
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['edge-impulse-projects', isAuthenticated],
    queryFn: getEIProjects,
    enabled: enableEdgeImpulseAutoRefresh && isAuthenticated,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    setUnoQProjects(projects?.filter((p) => p.hasUnoQLatencyDevice) || []);
  }, [projects]);

  const eiModels = useMemo(
    () => unoQProjects.map(mapProjectToModel),
    [unoQProjects],
  );

  const installedModelsQueryKey = useMemo(() => ['get-installed-models'], []);
  const { data: installedModels } = useQuery({
    queryKey: installedModelsQueryKey,
    queryFn: getAIModels,
    enabled: !!boardIsReachable,
  });
  const installedModelsLookup = useMemo(() => {
    const lookup: { [key: string]: AIModelItem } = {};
    for (const model of installedModels || []) {
      lookup[model.id ?? 'none'] = model;
    }
    return lookup;
  }, [installedModels]);

  const getInstalledModel = useCallback(
    (modelId: string, impulseId?: string) => {
      const id = impulseId ? `ei-model-${modelId}-${impulseId}` : modelId;
      return installedModelsLookup?.[id];
    },
    [installedModelsLookup],
  );

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
      return unoQProjects.filter((p) => {
        const match = isCompatibleEICategory(brickType, p.category, p.impulses);
        return match;
      });
    },
    [unoQProjects],
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

  const setDownloadNotification = useCallback(
    (modelId: string): void => {
      setNotification({
        label: `Model ${modelId} downloaded`,
        tooltip: 'Click to view in My Apps',
        icon: createElement(AiIcon),
        onClick: (): void => {
          const installed = queryClient.getQueryData<AIModelItem[]>(
            installedModelsQueryKey,
          );
          const brickId = installed?.find((m) => m.id === modelId)
            ?.brick_ids?.[0];
          navigate({
            to: '/bricks',
            search: { brickId, tab: 'aiModels' },
          });
        },
      });
    },
    [installedModelsQueryKey, navigate, queryClient, setNotification],
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
            impulseId,
            error: false,
            success: false,
            isDownloading: true,
          },
          projectId,
        );
        item = await installEIModel(projectId, impulseId);
        const itemId = item.id || `ei-model-${projectId}-${impulseId}`;
        queryClient.setQueryData(
          installedModelsQueryKey,
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
        setDownloadNotification(itemId);
        queryClient.setQueryData(
          outdatedModelsQueryKey,
          (prev: { [key: string]: boolean } | undefined) => ({
            ...prev,
            [itemId]: false,
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
      installedModelsQueryKey,
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
        project.hasUnoQLatencyDevice ||
        project.hasOtherNonDefaultLatencyDevice ||
        !project.id
      ) {
        openLinkExternal(url);
        return;
      }

      await setEILatencyDevice(project.id.toString());
      openLinkExternal(url);
    },

    onSuccess: async () => {
      await set(CHECK_STORAGE_KEY, true);
    },
  });

  // Keeps track of every in-flight download stream, keyed by the `modelId`
  // passed to `downloadAIModelSSE(modelId)`. This lets us run several
  // downloads concurrently and reliably associate each incoming SSE event
  // with the model it belongs to (via the closures created below).
  const downloadStreamsRef = useRef<
    Map<string, { abortController: AbortController; progress: number }>
  >(new Map());

  const downloadAIModelSSE = useCallback(
    async (modelId: string, progressKey?: string): Promise<boolean> => {
      // `modelId` targets the SSE endpoint and the installed-models cache,
      // while `progressKey` (defaulting to `modelId`) keys the download
      // progress. This lets callers that track progress under a different id
      // (e.g. an Edge Impulse project id) still light up their progress UI.
      const progressId = progressKey ?? modelId;
      // Restart cleanly if a download for the same model is already running.
      downloadStreamsRef.current.get(modelId)?.abortController.abort();

      const abortController = new AbortController();
      const stream = { abortController, progress: 0 };
      downloadStreamsRef.current.set(modelId, stream);

      let downloadSucceeded = false;

      const cleanup = (): void => {
        if (
          downloadStreamsRef.current.get(modelId)?.abortController ===
          abortController
        ) {
          downloadStreamsRef.current.delete(modelId);
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

      // A single download can be signalled as complete by more than one event
      // (`Done`, a `Progress` reaching 100, and/or a "download complete"
      // message). Run the terminal side-effects — success state, footer
      // notification and installed-models cache update — exactly once so the
      // notification panel doesn't stack duplicate entries.
      const completeDownload = (): void => {
        if (downloadSucceeded) {
          return;
        }
        downloadSucceeded = true;
        stream.progress = 100;
        updateDownload(
          {
            isDownloading: false,
            error: false,
            success: true,
            percentage: 100,
          },
          progressId,
        );
        setDownloadNotification(modelId);
        sendAppLabNotification({
          message: `Model ${modelId} downloaded`,
          variant: 'success',
        });
        queryClient.setQueryData(
          installedModelsQueryKey,
          (prev: AIModelItem[] | undefined) =>
            (prev || []).map((model) =>
              model.id === modelId ? { ...model, status: 'installed' } : model,
            ),
        );
      };

      // Every handler below closes over `modelId`, so the event is always
      // tied to the model passed to `downloadAIModelSSE(modelId)` regardless
      // of the event payload.
      const handlers: EventSourceHandlers = {
        onopen: undefined,
        onclose: cleanup,
        // Don't notify here: a fatal error re-throws and is surfaced by the
        // catch below (with the specific message, e.g. "HTTP 409"), and
        // transient errors are still being retried. Notifying here would
        // duplicate the catch's banner and fire on every retry attempt.
        onerror: (_error: Error) => {
          updateDownload(
            {
              isDownloading: false,
              error: true,
              success: false,
              percentage: 0,
            },
            progressId,
          );
          cleanup();
        },
        // TODO: refactor this to use a only the 'done' event to mark the download as complete
        // and send the download notification to the footer
        onmessage: (event: EventSourceMessage) => {
          const messageType = event.event;
          const data = JSON.parse(event.data);
          switch (messageType) {
            case StreamEventType.Error:
              // A normal end-of-stream is signalled as a SERVER_CLOSED error.
              if (data.code === 'SERVER_CLOSED') {
                break;
              }
              // in case of any other error, we want to invalidate the whole set of
              // installed models query so that the user can retry the download
              queryClient.invalidateQueries(installedModelsQueryKey);
              updateDownload(
                {
                  isDownloading: false,
                  error: true,
                  success: false,
                  percentage: 0,
                },
                progressId,
              );
              sendAppLabNotification({
                message:
                  data.message || 'An error occurred while downloading model',
                variant: 'error',
              });
              break;
            case StreamEventType.Done:
              completeDownload();
              break;
            case StreamEventType.Progress:
              stream.progress = data.progress;
              if (data.progress === 100) {
                completeDownload();
              } else {
                updateDownload(
                  {
                    percentage: data.progress,
                  },
                  progressId,
                );
              }
              break;
            case StreamEventType.Message:
              // 'Extracted to' is a hack to intercept the "download completed" event
              // on arduino-app-cli.rc.4
              if (
                data.message == 'download complete' ||
                data.message?.startsWith('Extracted to')
              ) {
                completeDownload();
              }
              break;
            default:
              break;
          }
        },
      };

      try {
        await uploadAIModel(modelId, handlers, abortController);
      } catch (error: unknown) {
        updateDownload(
          {
            isDownloading: false,
            error: true,
            success: false,
            percentage: 0,
          },
          progressId,
        );
        sendAppLabNotification({
          message:
            error instanceof Error
              ? `Error downloading model: ${error.message}`
              : 'An error occurred while downloading model',
          variant: 'error',
        });
        downloadSucceeded = false;
      } finally {
        cleanup();
      }

      return downloadSucceeded;
    },
    [queryClient, installedModelsQueryKey, setDownloadNotification],
  );

  return {
    projects: eiModels,
    projectsLoading,
    currentDownloads,
    installedModels: installedModels || [],
    isModelOutdated,
    getInstalledModel,
    getEIProjectsByBrickType,
    downloadImpulse,
    enabledEIAutoRefresh: setEnableEdgeImpulseAutoRefresh,
    openAndAssociateToDevice,
    downloadAIModelSSE,
  };
}
