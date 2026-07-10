import {
  deleteAIModel,
  getAppBrickInstance,
  getAppDetail,
  getBrickDetails,
  getFileContent,
  openLinkExternal,
  updateAppBrick,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AIModelItem,
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickInstance,
  EIProject,
} from '@cloud-editor-mono/infrastructure';
import {
  BrickDetailLogic,
  BrickDetailModel,
  BrickDetailModelImpulse,
  ConfigureAppBrickDialogLogic,
  TrainNewModelDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
// import { isEdgeImpulseModel } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab/ai-model/helpers';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { GET_BATCH_FILE_CONTENT_QUERY_KEY } from '../../common/hooks/queries/arduinoAppFiles';
import { sendAppLabNotification } from '../features/notifications';
import { AiModelsContext } from '../providers/ai-models/aiModelsContext';
import { AuthContext } from '../providers/auth/authContext';
import { BoardResourcesContext } from '../providers/board-resources/boardResourcesContext';
import { EdgeImpulseContext } from '../providers/edge-impulse/edgeImpulseContext';
import { useBoardLifecycleStore } from '../store/boardLifecycle';

export const makeAppBrickDetailLogic = (appId?: string) => {
  return (brickId: string): ReturnType<BrickDetailLogic> =>
    useBrickDetailLogic(brickId, appId);
};

export const useBrickDetailLogic: BrickDetailLogic = (
  brickId: string,
  appId?: string,
) => {
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
    installedModels,
    getInstalledModel,
    isModelOutdated,
    downloadAIModelSSE,
  } = useContext(AiModelsContext);

  const { homeDiskUsedGB, homeDiskTotalGB } = useContext(BoardResourcesContext);

  useEffect(() => {
    enabledEIAutoRefresh(true);
    return () => {
      enabledEIAutoRefresh(false);
    };
  }, [enabledEIAutoRefresh]);

  const { data: appDetail } = useQuery({
    queryKey: ['list-my-apps', appId],
    queryFn: () => (appId ? getAppDetail(appId) : undefined),
    enabled: !!appId,
  });

  const readOnly = !appId;
  const isExample = appDetail?.example === true;

  const { data: brick, isLoading: isBrickLoading } = useQuery({
    queryKey: ['get-brick-details', brickId],
    queryFn: () => getBrickDetails(brickId),
    enabled: !!brickId,
  });

  const { data: brickInstance } = useQuery({
    queryKey: ['get-brick-instance', brickId, appId],
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

  const usedByAppsInstances = useQueries({
    queries: (readOnly ? brick?.used_by_apps ?? [] : []).map((app) => ({
      queryKey: ['get-brick-instance', brickId, app.id],
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
    queryKey: ['get-brick-api-docs', brickId],
    queryFn: () => {
      if (!brick?.api_docs_path) {
        return null;
      }
      return getFileContent(brick?.api_docs_path);
    },
    enabled: !!brick,
  });

  const { data: examples } = useQuery({
    queryKey: ['get-brick-examples', brickId],
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
        })),
      );
    },
    enabled: !!brick,
  });

  const models: BrickDetailModel[] = useMemo(() => {
    // Builtin arduino models
    const builtInModels: BrickDetailModel[] = (brick?.compatible_models || [])
      .map((m) => getInstalledModel(m.id ?? ''))
      .filter((m): m is AIModelItem => !!m && m.is_builtin === true)
      .map(mapModelToBrickDetailModel);

    const customAiModels: BrickDetailModel[] = (brick?.compatible_models || [])
      .map((m) => getInstalledModel(m.id ?? ''))
      .filter(
        (m): m is AIModelItem =>
          !!m && !m.metadata?.['ei-project-id'] && !m.is_builtin === true,
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
            isOutdated: installed?.id
              ? isModelOutdated(installed.id)
              : undefined,
          };
        });

        return {
          id: project.id.toString(),
          name: project.name.toString(),
          description: project.description,
          isBuiltIn: false,
          source: 'edgeimpulse',
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
        !projectId ||
        m.is_builtin ||
        remoteModelsIdSet.has(projectId) ||
        !m.brick_ids?.includes(brick?.id ?? '') // only compatible category
      ) {
        // Exclude builtin models and models with associated remote edge impulse projects
        return acc;
      }

      const isInstalled = m.status === 'installed';

      const impulse: BrickDetailModelImpulse = {
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
          source: 'edgeimpulse',
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

    return [
      ...builtInModels,
      ...customAiModels,
      ...remoteEgeImpulseModels,
      ...Object.values(orphanEdgeImpulseModels),
    ];
  }, [
    brick,
    getEIProjectsByBrickType,
    getInstalledModel,
    installedModels,
    isModelOutdated,
  ]);

  const diskUsageWarning = useCallback(
    (modelId: string) => {
      const diskUsage = { used: homeDiskUsedGB, total: homeDiskTotalGB };
      const model = models.find((m) => m.id === modelId);
      if (!model) {
        return undefined;
      }
      const modelSizeMB = parseFloat(model.metadata?.model_size_mb || '0');
      const modelSizeGB = modelSizeMB / 1024;

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
        ['get-brick-instance', brickId, appId],
        (prev: BrickInstance | undefined) => ({ ...prev, model: modelId }),
      );

      const prevId = brickInstance?.model;
      const success = await updateAppBrick(appId ?? '', brickId, {
        model: modelId,
      });
      if (success) {
        if (appDetail?.path) {
          queryClient.invalidateQueries({
            queryKey: [
              GET_BATCH_FILE_CONTENT_QUERY_KEY,
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
          ['get-brick-instance', brickId, appId],
          (prev: BrickInstance | undefined) => ({ ...prev, model: prevId }),
        );
        sendAppLabNotification({
          message: 'An error occurred while setting model',
          variant: 'error',
        });
      }
    },
    [appId, appDetail, brick?.name, brickId, brickInstance?.model, queryClient],
  );

  const downloadGenericModel = useCallback(
    async (modelId: string): Promise<void> => {
      const success = await downloadAIModelSSE(modelId);
      if (success && !readOnly) {
        await updateModelInUse(modelId, true);
      }
    },
    [downloadAIModelSSE, readOnly, updateModelInUse],
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
        const success = await downloadAIModelSSE(modelId, projectId);
        if (success && !readOnly) {
          await updateModelInUse(modelId, true);
        }
        return;
      }

      // Linked Edge Impulse models are installed from the Edge Impulse cloud,
      // which requires a linked account.
      const model = await downloadImpulse(projectId, impulseId);
      if (model) {
        queryClient.setQueryData(
          ['get-brick-details', brickId],
          (prev: BrickDetails | undefined) => ({
            ...prev,
            compatible_models: (brick?.compatible_models || []).concat(model),
          }),
        );

        // Select model
        if (!readOnly) {
          await updateModelInUse(model.id ?? '', true);
          sendAppLabNotification({
            message: `Installation complete ${model.name} is now installed and in use`,
            variant: 'success',
          });
        }
      }
    },
    [
      brick,
      brickId,
      models,
      readOnly,
      downloadAIModelSSE,
      downloadImpulse,
      queryClient,
      updateModelInUse,
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
      const modelName = getInstalledModel(modelId)?.name;
      await deleteAIModel(modelId, isForced);
      queryClient.setQueryData(
        ['get-installed-models'],
        (prev: AIModelItem[] | undefined) => {
          // update the model just downloaded with id `modelId` to have `status: 'notinstalled'`
          return (prev || []).map((model) => {
            if (model.id === modelId) {
              return {
                ...model,
                status: 'notinstalled',
              };
            }
            return model;
          });
        },
      );

      queryClient.invalidateQueries(['get-installed-models']);

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
      let url = '';
      const model = models.find((m) => m.id === modelId);
      if (model?.edgeImpulseProps) {
        url = `https://studio.edgeimpulse.com/studio/${model.edgeImpulseProps.projectId}`;
        if (impulseId) {
          url += `/impulse/${impulseId}/create-impulse`;
        }
      } else {
        url = model?.url ?? model?.metadata?.['source-model-url'] ?? '';
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

  const [trainNewModelDialogOpen, setTrainNewModelDialogOpen] = useState(false);

  /*
   * TODO: fix this 
   * THIS WOULD BE THE CORRECT LOGIC, if only had that `ai_frameworks_compatibility` field in the json feed 
   *
    const hideEdgeImpulse =
      brick?.ai_frameworks_compatibility?.includes('edgeImpulse') === false;
   * 
   * BUT in the meanwhile, we will use a whitelist of bricks that we know are
   * not compatible with Edge Impulse
   */
  const hideEdgeImpulse = [
    'arduino:llm',
    'arduino:vlm',
    'arduino:gesture_recognition',
    'arduino:asr',
    'arduino:tts',
  ].includes(brick?.id ?? '');

  const trainNewModelDialogProps:
    | ReturnType<BrickDetailLogic>['trainNewModelDialogProps']
    | undefined = useMemo(
    () =>
      !hideEdgeImpulse
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
      hideEdgeImpulse,
      isWelcomePageDismissed,
      openAndAssociateToDevice,
      trainNewModelDialogOpen,
    ],
  );

  const onTrainNewModelClick = useCallback(() => {
    if (isEdgeImpulseConnected) {
      openAndAssociateToDevice();
      return;
    }
    setTrainNewModelDialogOpen(true);
  }, [isEdgeImpulseConnected, openAndAssociateToDevice]);

  const selectedBoard = useBoardLifecycleStore(
    (state) => state.selectedConnectedBoard,
  );

  return {
    board: selectedBoard,
    brick,
    isBrickLoading,
    brickInstance,
    isCustomBrick: brick?.author !== 'Arduino',
    readOnly,
    readme,
    apiDocs,
    examples,
    models,
    configureDialogProps,
    trainNewModelDialogProps,
    diskUsageWarning,
    isEdgeImpulseConnected,
    hideEdgeImpulse,
    isExample,
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
        queryClient.invalidateQueries(['get-brick-instance', brickId, appId]);
        queryClient.invalidateQueries(['app-bricks', appId]);
      }
      return success;
    },
    [appId, brickId, queryClient],
  );

  const { data: brickInstance } = useQuery({
    queryKey: ['get-brick-instance', brickId, appId],
    queryFn: () => getAppBrickInstance(appId ?? '', brickId!),
    enabled: !!appId && !!brickId && open,
  });

  return {
    brickInstance,
    confirmAction,
  };
};

function mapModelToBrickDetailModel(model: AIModelItem): BrickDetailModel {
  return {
    id: model.id ?? '',
    name: model.name ?? '',
    description: model.description ?? '',
    source: model.metadata?.source || 'edgeimpulse',
    url: model.metadata?.['ei-model-url'],
    metadata: model.metadata ?? {},
    isInstalled: model.status == 'installed' || false,
    isBuiltIn: !!model.is_builtin,
  };
}
