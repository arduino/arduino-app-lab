import {
  deleteAIModel,
  getAppBrickInstance,
  getAppBricks,
  getAppDetail,
  getBrickDetails,
  getFileContent,
  openLinkExternal,
  updateAppBrick,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AiFramework,
  AIModelItem,
  AppBrickDetails,
  AppBrickListItem,
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickModel,
  EIProject,
  isUnsupportedEndpointError,
} from '@cloud-editor-mono/infrastructure';
import {
  AiModelImpulse,
  BrickDetailLogic,
  BrickDetailModel,
  ConfigureAppBrickDialogLogic,
  EDGE_IMPULSE_SOURCE,
  getDownloadableSourceUrl,
  getHuggingFaceModelPlaceholderName,
  getModelPageUrl,
  HUGGING_FACE_SOURCE,
  isEdgeImpulseModel,
  TrainNewModelDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BoardScopedQuery } from '../boardScopedQuery';
import { GET_FILE_CONTENT_QUERY_KEY } from '../features/app/app-detail/hooks/useFileContents';
import { sendAppLabNotification } from '../features/notifications';
import { useAiModels } from '../providers/ai-models/aiModelsContext';
import { AuthContext } from '../providers/auth/authContext';
import { EdgeImpulseContext } from '../providers/edge-impulse/edgeImpulseContext';
import { bytesToGiB, useBoardResourcesStore } from '../store/boardResources';
import { plainModelId } from '../utils/modelId';

const HUGGING_FACE_MODEL_COMPATIBLE_BRICK_IDS = ['arduino:llm'];

// logic used in `arduino-app-cli` versions < 0.14.0
const EI_TRAIN_NEW_MODEL_INCOMPATIBLE_BRICK_IDS = [
  'arduino:llm',
  'arduino:vlm',
  'arduino:gesture_recognition',
  'arduino:asr',
  'arduino:tts',
];

const EDGE_IMPULSE_AI_FRAMEWORK: AiFramework = 'edgeimpulse';

export const makeAppBrickDetailLogic = (appId?: string): BrickDetailLogic => {
  return (brickId, onModelInstalled) =>
    useBrickDetailLogic(brickId, appId, onModelInstalled);
};

export const useBrickDetailLogic = (
  brickId: string,
  appId?: string,
  onModelInstalled?: (modelId: string) => void,
): ReturnType<BrickDetailLogic> => {
  const queryClient = useQueryClient();

  const {
    user: arduinoUser,
    login: arduinoLogin,
    isWelcomePageDismissed,
    dismissWelcomePage,
  } = useContext(AuthContext);
  const { user: edgeImpulseUser, login: edgeImpulseLogin } =
    useContext(EdgeImpulseContext);

  const isEdgeImpulseConnected = !!arduinoUser && !!edgeImpulseUser;

  const {
    openAndAssociateToDevice,
    enabledEIAutoRefresh,
    getEIProjectsByBrickType,
    downloadImpulse,
    currentDownloads,
    clearDownload,
    installedModels,
    getInstalledModel,
    isModelOutdated,
    installAIModelSSE,
    downloadAIModelSSE,
  } = useAiModels();

  const homeDiskUsed = useBoardResourcesStore(
    (state) => state.resources?.homeDisk?.used,
  );
  const homeDiskTotal = useBoardResourcesStore(
    (state) => state.resources?.homeDisk?.total,
  );
  const homeDiskUsedGB = bytesToGiB(homeDiskUsed);
  const homeDiskTotalGB = bytesToGiB(homeDiskTotal);

  useEffect(() => {
    enabledEIAutoRefresh(true);
    return () => {
      enabledEIAutoRefresh(false);
    };
  }, [enabledEIAutoRefresh]);

  const { data: appDetail } = useQuery({
    queryKey: [BoardScopedQuery.LIST_MY_APPS, appId],
    queryFn: () => (appId ? getAppDetail(appId) : undefined),
    enabled: !!appId,
  });

  const readOnly = !appId;
  const isReadOnlyApp =
    appDetail?.example === true || appDetail?.release === true;

  const { data: brick, isLoading: isBrickLoading } = useQuery({
    queryKey: [BoardScopedQuery.GET_BRICK_DETAILS, brickId],
    queryFn: () => getBrickDetails(brickId),
    enabled: !!brickId,
  });

  const { data: brickInstance } = useQuery({
    queryKey: [BoardScopedQuery.GET_BRICK_INSTANCE, brickId, appId],
    queryFn: () => getAppBrickInstance(appId ?? '', brickId),
    // Gate only on having an app + brick context. Previously this depended on
    // `appDetail.bricks`, but the app's brick set is tracked by a separate
    // query (`['app-bricks', appId]`) that is the one refreshed on add/remove,
    // while `appDetail` (`['list-my-apps', appId]`) is not. That left the
    // instance query disabled against a stale `appDetail`, so `brickInstance`
    // (and thus the in-use model) read `undefined` until an unrelated event
    // refreshed `appDetail`. In the brick-list (read-only) flow `appId` is
    // undefined, so this stays disabled as before.
    enabled: !!appId && !!brickId,
  });

  // Keeps the app's brick list cached for selectInstalledModel.
  useQuery({
    queryKey: [BoardScopedQuery.APP_BRICKS, appId],
    queryFn: () => getAppBricks(appId ?? ''),
    enabled: !!appId,
  });

  const usedByAppsInstances = useQueries({
    queries: (readOnly ? brick?.used_by_apps ?? [] : []).map((app) => ({
      queryKey: [BoardScopedQuery.GET_BRICK_INSTANCE, brickId, app.id],
      queryFn: () => getAppBrickInstance(app.id ?? '', brickId),
      enabled: !!app.id && !!brickId,
    })),
  });

  const referencedModelIds = new Set(
    usedByAppsInstances
      .map((query) => query.data?.model)
      .filter((model): model is string => !!model),
  );

  const isModelInstalledInApp = (model: BrickDetailModel): boolean =>
    referencedModelIds.has(model.id) ||
    (model.edgeImpulseProps?.impulses ?? []).some(
      (impulse) =>
        !!impulse.installedModelId &&
        referencedModelIds.has(impulse.installedModelId),
    );

  const readme = useMemo(
    () =>
      brickInstance?.readme?.trim()
        ? brickInstance.readme
        : brick?.readme?.trim()
        ? brick.readme
        : null,
    [brick, brickInstance],
  );

  const { data: apiDocs } = useQuery({
    queryKey: [BoardScopedQuery.GET_BRICK_API_DOCS, brickId],
    queryFn: () => {
      if (!brick?.api_docs_path) {
        return null;
      }
      return getFileContent(brick?.api_docs_path);
    },
    enabled: !!brick,
  });

  const { data: examples } = useQuery({
    queryKey: [BoardScopedQuery.GET_BRICK_EXAMPLES, brickId],
    queryFn: async () => {
      const items =
        brick?.code_examples?.filter((example) => example.path) ?? [];
      if (items.length === 0) {
        return null;
      }
      return Promise.all(
        items.map(async (example) => ({
          content:
            '```python\n' + (await getFileContent(example.path!)) + '\n```',
          path: example.path!,
          exampleName: example.name ?? undefined,
          exampleId: example.encoded_id ?? undefined,
        })),
      );
    },
    enabled: !!brick,
  });

  // No brick declares a model the user has only just typed a source for, so the
  // placeholder row comes from the download registry, not from local state.
  const huggingFaceModelDownloads = useMemo(
    () =>
      Object.entries(currentDownloads || {}).filter(
        ([, info]) => info.linkedBrickId === brickId && !info.error,
      ),
    [brickId, currentDownloads],
  );

  const models: BrickDetailModel[] = useMemo(() => {
    // Builtin arduino models
    const builtInModels: BrickDetailModel[] = (brick?.compatible_models || [])
      .map((m) => getInstalledModel(m.id ?? ''))
      .filter((m): m is AIModelItem => !!m && !!m.is_builtin)
      .map(mapModelToBrickDetailModel);

    const customAiModels: BrickDetailModel[] = (brick?.compatible_models || [])
      .map((m) => getInstalledModel(m.id ?? ''))
      .filter(
        (m): m is AIModelItem =>
          !!m && !isUserEdgeImpulseProjectModel(m) && !m.is_builtin,
      )
      .map(mapModelToBrickDetailModel);

    // Remote edge impulse studio models
    const currentRemoteEdgeImpulseProject = getEIProjectsByBrickType(
      brick?.id ?? '',
    );

    const remoteEgeImpulseModels: BrickDetailModel[] =
      currentRemoteEdgeImpulseProject.map((project: EIProject) => {
        // Impulses known to the board but missing from the remote project
        // (e.g. deleted from Edge Impulse studio, or offered for download
        // without being installed). Their installed state comes from `status`.
        const orphanImpulses = (installedModels || [])
          .filter(
            (model) =>
              model.metadata?.['ei-project-id'] === project.id.toString() &&
              !project.impulses?.find(
                (impulse) =>
                  impulse.id.toString() === model.metadata?.['ei-impulse-id'],
              ),
          )
          .map((model) => {
            const isInstalled = model.status === 'installed';
            return {
              id: model.metadata?.['ei-impulse-id'] ?? '',
              name: model.metadata?.['ei-impulse-name'] ?? '',
              isInstalled,
              installedModelId: isInstalled ? model.id : undefined,
              // Known to the board: downloadable by id without an EI login.
              downloadModelId: model.id,
              isOutdated: false,
            };
          });

        const remoteImpulses = (project.impulses || []).map((i) => {
          const installed = getInstalledModel(
            project.id.toString(),
            i.id.toString(),
          );
          return {
            id: i.id.toString(),
            name: i.name,
            isInstalled: !!installed,
            installedModelId: installed?.id,
            // The outdated lookup is keyed the way `app.yaml` names a model,
            // not the way a models response addresses one.
            isOutdated: installed
              ? isModelOutdated(plainModelId(installed))
              : undefined,
          };
        });

        return {
          id: project.id.toString(),
          name: project.name.toString(),
          description: project.description,
          isBuiltIn: false,
          source: EDGE_IMPULSE_SOURCE,
          origin: 'edge-impulse-user-project',
          isInstalled:
            remoteImpulses.some((i) => i.isInstalled) ||
            orphanImpulses.some((i) => i.isInstalled),
          metadata: project.metadata,
          edgeImpulseProps: {
            projectId: project.id.toString(),
            impulses: [...remoteImpulses, ...orphanImpulses],
          },
        };
      });

    // For faster lookup
    const remoteModelsIdSet = new Set(
      remoteEgeImpulseModels.map((p) => p.edgeImpulseProps?.projectId),
    );

    // Edge Impulse models known to the board but not backed by a linked remote
    // EI project. This covers two cases now that the board can expose EI models
    // without a linked EI account:
    //   1. Orphans: a model installed on the board whose project was deleted /
    //      is no longer available in Edge Impulse studio.
    //   2. Unlinked: a model the board offers for download that has not been
    //      installed yet (`status !== 'installed'`).
    // Previously every EI model returned here implied installation had taken
    // place, so we must derive the installed state from `status` rather than
    // assume it.
    const orphanEdgeImpulseModels = (installedModels || []).reduce((acc, m) => {
      const projectId = m.metadata?.['ei-project-id'];
      if (
        !isUserEdgeImpulseProjectModel(m) ||
        !projectId ||
        m.is_builtin ||
        remoteModelsIdSet.has(projectId) ||
        !m.brick_ids?.includes(brick?.id ?? '') // only compatible category
      ) {
        // Exclude builtin models and models with associated remote edge impulse projects
        return acc;
      }

      const isInstalled = m.status === 'installed';

      const impulse: AiModelImpulse = {
        id: m.metadata?.['ei-impulse-id'] ?? '',
        name: m.metadata?.['ei-impulse-name'] ?? '',
        isInstalled,
        // Only installed models can be selected/uninstalled by their model id.
        installedModelId: isInstalled ? m.id : undefined,
        // Known to the board: downloadable by id without an EI login.
        downloadModelId: m.id,
        isOutdated: false,
      };

      if (!acc[projectId]) {
        acc[projectId] = {
          id: projectId,
          name: m.name ?? '',
          description: m.description ?? '',
          isBuiltIn: false,
          isInstalled,
          source: EDGE_IMPULSE_SOURCE,
          origin: m.origin,
          metadata: m.metadata ?? {},
          edgeImpulseProps: { projectId, impulses: [] },
        };
      } else if (isInstalled) {
        // A project is installed as soon as any of its impulses is.
        acc[projectId].isInstalled = true;
      }
      acc[projectId].edgeImpulseProps!.impulses.push(impulse);
      return acc;
    }, {} as Record<string, BrickDetailModel>);

    const huggingFaceModels: BrickDetailModel[] = huggingFaceModelDownloads.map(
      ([source, info]) => ({
        id: source,
        name: getHuggingFaceModelPlaceholderName(source, info.fileName),
        description: '',
        source: HUGGING_FACE_SOURCE,
        origin: 'user',
        metadata: {
          source: HUGGING_FACE_SOURCE,
        },
        isInstalled: false,
        isBuiltIn: false,
        isPlaceholder: true,
      }),
    );

    return [
      ...builtInModels,
      ...customAiModels,
      ...huggingFaceModels,
      ...remoteEgeImpulseModels,
      ...Object.values(orphanEdgeImpulseModels),
    ];
  }, [
    brick,
    getEIProjectsByBrickType,
    getInstalledModel,
    installedModels,
    isModelOutdated,
    huggingFaceModelDownloads,
  ]);

  const diskUsageWarning = useCallback(
    (modelId: string) => {
      const diskUsage = { used: homeDiskUsedGB, total: homeDiskTotalGB };
      const model = models.find((m) => m.id === modelId);
      if (!model) {
        return undefined;
      }
      const modelSizeGB = (model.size ?? 0) / 1024 ** 3;

      // Show warning if the model size is larger than the available space
      if (
        modelSizeGB > 0 &&
        homeDiskUsedGB &&
        homeDiskTotalGB &&
        parseFloat(homeDiskTotalGB) - parseFloat(homeDiskUsedGB) < modelSizeGB
      ) {
        return diskUsage;
      }

      // Otherwise, only show if less than 500MB free
      if (
        homeDiskUsedGB &&
        homeDiskTotalGB &&
        parseFloat(homeDiskTotalGB) - parseFloat(homeDiskUsedGB) < 0.5
      ) {
        return diskUsage;
      }
      return undefined;
    },
    [models, homeDiskTotalGB, homeDiskUsedGB],
  );

  const updateModelInUse = useCallback(
    async (
      modelId: string,
      dismissSuccessNotification?: boolean,
    ): Promise<void> => {
      // Optimistic update
      queryClient.setQueryData(
        [BoardScopedQuery.GET_BRICK_INSTANCE, brickId, appId],
        (prev: AppBrickDetails | undefined) => ({ ...prev, model: modelId }),
      );

      const prevId = brickInstance?.model;
      const success = await updateAppBrick(appId ?? '', brickId, {
        model: modelId,
      });
      if (success) {
        if (appDetail?.path) {
          queryClient.invalidateQueries({
            queryKey: [
              GET_FILE_CONTENT_QUERY_KEY,
              appDetail.path + '/app.yaml',
            ],
          });
        }
        !dismissSuccessNotification &&
          sendAppLabNotification({
            message: `AI model successfully added to ${
              brick?.name ?? ''
            } brick`,
            variant: 'success',
          });
      } else {
        queryClient.setQueryData(
          [BoardScopedQuery.GET_BRICK_INSTANCE, brickId, appId],
          (prev: AppBrickDetails | undefined) => ({ ...prev, model: prevId }),
        );
        sendAppLabNotification({
          message: 'An error occurred while setting model',
          variant: 'error',
        });
      }
    },
    [appId, appDetail, brick?.name, brickId, brickInstance?.model, queryClient],
  );

  const selectInstalledModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      // In the Add Brick dialog the brick is added to the app only on "Add":
      // until then the daemon rejects a model update for it. Read from the
      // cache because "Add" can happen while the download runs.
      const appBricks = queryClient.getQueryData<AppBrickListItem[]>([
        BoardScopedQuery.APP_BRICKS,
        appId,
      ]);
      if (readOnly || !appBricks?.some((b) => b.id === brickId)) {
        onModelInstalled?.(modelId);
        return false;
      }
      await updateModelInUse(modelId, true);
      return true;
    },
    [appId, brickId, onModelInstalled, queryClient, readOnly, updateModelInUse],
  );

  // Guarded: a brick-details entry that was reset must not come back as a lone
  // `compatible_models` list with no id, name or author.
  const addCompatibleModel = useCallback(
    (model: BrickModel) => {
      queryClient.setQueryData(
        [BoardScopedQuery.GET_BRICK_DETAILS, brickId],
        (prev: BrickDetails | undefined) => {
          if (!prev) {
            return prev;
          }
          const models = prev.compatible_models || [];
          return models.some((m) => m.id === model.id)
            ? prev
            : { ...prev, compatible_models: models.concat(model) };
        },
      );
    },
    [brickId, queryClient],
  );

  const downloadGenericModel = useCallback(
    async (modelId: string): Promise<void> => {
      const installed = await installAIModelSSE(modelId);
      if (installed) {
        await selectInstalledModel(installed.id);
      }
    },
    [installAIModelSSE, selectInstalledModel],
  );

  const downloadEIModel = useCallback(
    async (projectId: string, impulseId: string) => {
      const impulse = models
        .find((m) => m.edgeImpulseProps?.projectId === projectId)
        ?.edgeImpulseProps?.impulses.find((i) => i.id === impulseId);

      // Unlinked Edge Impulse models are already known to the board and can be
      // downloaded by id through the generic, login-free path (no Edge Impulse
      // account required). Progress is reported under `projectId` so the model
      // card's progress bar keeps working.
      if (impulse?.downloadModelId) {
        const modelId = impulse.downloadModelId;
        const installed = await installAIModelSSE(modelId, {
          progressKey: projectId,
        });
        if (installed) {
          await selectInstalledModel(installed.id);
        }
        return;
      }

      // Linked Edge Impulse models are installed from the Edge Impulse cloud,
      // which requires a linked account.
      const model = await downloadImpulse(projectId, impulseId);
      if (model) {
        addCompatibleModel(model);

        // Select model
        const isModelInUse = await selectInstalledModel(model.id);
        if (isModelInUse) {
          sendAppLabNotification({
            message: `Installation complete ${model.name} is now installed and in use`,
            variant: 'success',
          });
        }
      }
    },
    [
      addCompatibleModel,
      models,
      installAIModelSSE,
      downloadImpulse,
      selectInstalledModel,
    ],
  );

  const [uninstallingModels, setUninstallingModels] = useState<
    Record<string, boolean>
  >({});

  // Synchronous re-entrancy guard: `uninstallingModels` state can't stop a
  // rapid double-click (both calls read the same stale state before React
  // re-renders), which would fire two "uninstalled" snackbars. A ref updates
  // immediately, so a second call for the same model while one is in flight is
  // ignored.
  const uninstallingModelsRef = useRef<Record<string, boolean>>({});

  const isModelUninstalling = useCallback(
    (modelId: string): boolean => !!uninstallingModels[modelId],
    [uninstallingModels],
  );

  const removeModel = async (
    modelId: string,
    isForced?: boolean,
  ): Promise<void> => {
    if (uninstallingModelsRef.current[modelId]) {
      return;
    }
    uninstallingModelsRef.current[modelId] = true;
    setUninstallingModels((prev) => ({ ...prev, [modelId]: true }));
    try {
      const removedModel = getInstalledModel(modelId);
      const modelName = removedModel?.name;
      // A user-linked model is listed only while it is downloaded; a declared
      // one stays on the list as downloadable.
      const isUserModel = removedModel?.origin === 'user';
      await deleteAIModel(modelId, isForced);
      queryClient.setQueryData(
        [BoardScopedQuery.GET_INSTALLED_MODELS],
        (prev: AIModelItem[] | undefined) => {
          return (
            (prev || [])
              .filter((model) => !(isUserModel && model.id === modelId))
              // update the model just downloaded with id `modelId` to have `status: 'not-installed'`
              .map((model) =>
                model.id === modelId
                  ? { ...model, status: 'not-installed' as const }
                  : model,
              )
          );
        },
      );

      if (isUserModel) {
        // It is gone from the board, so no brick can offer it any more — every
        // cached brick, not just this one.
        queryClient.setQueriesData(
          { queryKey: [BoardScopedQuery.GET_BRICK_DETAILS] },
          (prev: BrickDetails | undefined) =>
            prev && {
              ...prev,
              compatible_models: (prev.compatible_models || []).filter(
                (m) => m.id !== modelId,
              ),
            },
        );
      }

      queryClient.invalidateQueries({
        queryKey: [BoardScopedQuery.GET_INSTALLED_MODELS],
      });

      sendAppLabNotification({
        message: `${modelName} successfully uninstalled`,
        variant: 'success',
      });
    } catch (error) {
      if (error instanceof Error) {
        sendAppLabNotification({
          message: error.message,
          variant: 'error',
        });
      } else {
        console.error(error);
      }
    } finally {
      uninstallingModelsRef.current[modelId] = false;
      setUninstallingModels((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const getDownloadInfo = useCallback(
    (projectId: string) => {
      const downloadItem = currentDownloads?.[projectId];
      return downloadItem;
    },
    [currentDownloads],
  );

  const openExternalLink = useCallback((url: string): void => {
    if (!url) {
      console.warn('Cannot open empty url');
      return;
    }
    openLinkExternal(url);
  }, []);

  const openModelPage = useCallback(
    (modelId: string, impulseId?: string) => {
      const model = models.find((m) => m.id === modelId);
      if (!model) {
        return;
      }

      let url: string;
      if (isEdgeImpulseModel(model)) {
        url = `https://studio.edgeimpulse.com/studio/${model.edgeImpulseProps.projectId}`;
        if (impulseId) {
          url += `/impulse/${impulseId}/create-impulse`;
        }
      } else {
        url = getModelPageUrl(
          model.url || model.metadata?.['source-model-url'] || '',
        );
      }

      openExternalLink(url);
    },
    [models, openExternalLink],
  );

  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);
  const configureDialogLogic: ConfigureAppBrickDialogLogic = useCallback(
    useConfigureAppBrickDialog,
    [],
  );
  const configureDialogProps:
    | ReturnType<BrickDetailLogic>['configureDialogProps']
    | undefined = useMemo(
    () =>
      !readOnly && appId && !!brickInstance
        ? {
            appId,
            logic: configureDialogLogic,
            open: configureDialogOpen,
            setOpen: setConfigureDialogOpen,
            onOpenExternal: openExternalLink,
          }
        : undefined,
    [
      appId,
      brickInstance,
      configureDialogLogic,
      configureDialogOpen,
      openExternalLink,
      readOnly,
    ],
  );

  // ai_frameworks_compatibility is missing on `arduino-app-cli` versions < 0.14.0
  const trainNewModelEnabled =
    (brick?.ai_frameworks_compatibility
      ? brick.ai_frameworks_compatibility.includes(EDGE_IMPULSE_AI_FRAMEWORK)
      : !EI_TRAIN_NEW_MODEL_INCOMPATIBLE_BRICK_IDS.includes(brick?.id ?? '')) &&
    !isReadOnlyApp;

  const [trainNewModelDialogOpen, setTrainNewModelDialogOpen] = useState(false);

  const trainNewModelDialogProps:
    | ReturnType<BrickDetailLogic>['trainNewModelDialogProps']
    | undefined = useMemo(
    () =>
      trainNewModelEnabled
        ? {
            open: trainNewModelDialogOpen,
            onOpenChange: setTrainNewModelDialogOpen,
            logic: (): ReturnType<TrainNewModelDialogLogic> => ({
              isArduinoConnected: !!arduinoUser,
              isEdgeImpulseConnected: !!edgeImpulseUser,
              isWelcomePageDismissed: !!isWelcomePageDismissed,
              dismissWelcomePage,
              arduinoLogin,
              edgeImpulseLogin,
              openEdgeImpulse: openAndAssociateToDevice,
            }),
          }
        : undefined,
    [
      arduinoLogin,
      arduinoUser,
      dismissWelcomePage,
      edgeImpulseLogin,
      edgeImpulseUser,
      isWelcomePageDismissed,
      openAndAssociateToDevice,
      trainNewModelDialogOpen,
      trainNewModelEnabled,
    ],
  );

  const onTrainNewModelClick = useCallback(() => {
    if (isEdgeImpulseConnected) {
      openAndAssociateToDevice();
      return;
    }
    setTrainNewModelDialogOpen(true);
  }, [isEdgeImpulseConnected, openAndAssociateToDevice]);

  const addHuggingFaceModelEnabled =
    HUGGING_FACE_MODEL_COMPATIBLE_BRICK_IDS.includes(brick?.id ?? '') &&
    !isReadOnlyApp;

  const downloadHuggingFaceModel = useCallback(
    (source: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        downloadAIModelSSE(source, {
          linkedBrickId: brickId,
          onStarted: resolve,
          onError: (error) => {
            if (isUnsupportedEndpointError(error)) {
              resolve();
              return;
            }
            reject(error);
          },
        })
          .then(async (installed) => {
            if (installed) {
              addCompatibleModel(installed);
            }

            clearDownload(source);

            if (installed) {
              await selectInstalledModel(installed.id);
            }
          })
          .catch((error: unknown) => {
            clearDownload(source);
            reject(error);
          });
      }),
    [
      addCompatibleModel,
      brickId,
      clearDownload,
      downloadAIModelSSE,
      selectInstalledModel,
    ],
  );

  const isHuggingFaceModelSourceDownloading = useCallback(
    (source: string): boolean => !!currentDownloads?.[source]?.isDownloading,
    [currentDownloads],
  );

  const isHuggingFaceModelSourceInstalled = useCallback(
    (source: string): boolean =>
      models.some(
        (model) =>
          model.isInstalled && getDownloadableSourceUrl(model) === source,
      ),
    [models],
  );

  const [addHuggingFaceModelDialogOpen, setAddHuggingFaceModelDialogOpen] =
    useState(false);

  const addHuggingFaceModelDialogProps: ReturnType<BrickDetailLogic>['addHuggingFaceModelDialogProps'] =
    useMemo(
      () =>
        addHuggingFaceModelEnabled
          ? {
              open: addHuggingFaceModelDialogOpen,
              onOpenChange: setAddHuggingFaceModelDialogOpen,
              downloadModel: downloadHuggingFaceModel,
              isSourceDownloading: isHuggingFaceModelSourceDownloading,
              isSourceInstalled: isHuggingFaceModelSourceInstalled,
              onOpenExternal: openExternalLink,
            }
          : undefined,
      [
        addHuggingFaceModelEnabled,
        addHuggingFaceModelDialogOpen,
        downloadHuggingFaceModel,
        isHuggingFaceModelSourceDownloading,
        isHuggingFaceModelSourceInstalled,
        openExternalLink,
      ],
    );

  return {
    brick,
    isBrickLoading,
    brickInstance,
    isCustomBrick: brick?.author !== 'Arduino',
    readOnly,
    addHuggingFaceModelEnabled,
    readme,
    apiDocs,
    examples,
    models,
    configureDialogProps,
    trainNewModelDialogProps,
    addHuggingFaceModelDialogProps,
    diskUsageWarning,
    trainNewModelEnabled,
    isReadOnlyApp,
    openExternalLink,
    openModelPage,
    onTrainNewModelClick,
    removeModel,
    downloadEIModel,
    downloadGenericModel,
    getDownloadInfo,
    updateModelInUse,
    isModelUninstalling,
    isModelInstalledInApp,
  };
};

export const useConfigureAppBrickDialog: ConfigureAppBrickDialogLogic = (
  params,
) => {
  const { appId, brickId, open } = params;

  const queryClient = useQueryClient();

  const confirmAction = useCallback(
    async (req: BrickCreateUpdateRequest): Promise<boolean> => {
      if (!brickId) {
        console.error('Brick ID is required to update brick');
        return false;
      }
      const success = await updateAppBrick(appId, brickId, req);
      if (success) {
        queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.GET_BRICK_INSTANCE, brickId, appId],
        });
        queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.APP_BRICKS, appId],
        });
      }
      return success;
    },
    [appId, brickId, queryClient],
  );

  const { data: brickInstance } = useQuery({
    queryKey: [BoardScopedQuery.GET_BRICK_INSTANCE, brickId, appId],
    queryFn: () => getAppBrickInstance(appId ?? '', brickId!),
    enabled: !!appId && !!brickId && open,
  });

  return {
    brickInstance,
    confirmAction,
  };
};

// `origin` is the authoritative answer, but a daemon older than the
// one-endpoint API sends none: there, the Edge Impulse metadata is the only
// thing that names a model as the user's own deployment.
const isUserEdgeImpulseProjectModel = (model: AIModelItem): boolean =>
  model.origin
    ? model.origin === 'edge-impulse-user-project'
    : !!model.metadata?.['ei-project-id'];

const getModelSource = (model: AIModelItem): string | undefined => {
  if (model.metadata?.source) {
    return model.metadata.source;
  }

  switch (model.origin) {
    case 'user':
      return HUGGING_FACE_SOURCE;
    case 'edge-impulse-user-project':
      return EDGE_IMPULSE_SOURCE;
    // `curated` says the board's list declares the model, not where it came
    // from; those entries name their provider in metadata, read above.
    default:
      return undefined;
  }
};

const mapModelToBrickDetailModel = (model: AIModelItem): BrickDetailModel => ({
  id: model.id,
  name: model.name ?? '',
  description: model.description ?? '',
  source: getModelSource(model),
  origin: model.origin,
  url: model.metadata?.['ei-model-url'],
  metadata: model.metadata ?? {},
  size: model.size ?? undefined,
  isInstalled: model.status === 'installed',
  isBuiltIn: !!model.is_builtin,
});
