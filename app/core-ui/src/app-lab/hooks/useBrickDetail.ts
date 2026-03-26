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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { sendAppLabNotification } from '../features/notifications';
import { AuthContext } from '../providers/auth/authContext';
import { BoardResourcesContext } from '../providers/board-resources/boardResourcesContext';
import { EdgeImpulseContext } from '../providers/edge-impulse/edgeImpulseContext';
import { EdgeImpulseModelsContext } from '../providers/edge-impulse-models/edgeImpulseModelsContext';

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
  } = useContext(EdgeImpulseModelsContext);

  const { homeDiskUsedGB, homeDiskTotalGB } = useContext(BoardResourcesContext);
  const diskUsage = { used: homeDiskUsedGB, total: homeDiskTotalGB };
  // Only show if less then 500MB free
  const diskUsageWarning =
    homeDiskUsedGB &&
    homeDiskTotalGB &&
    parseFloat(homeDiskTotalGB) - parseFloat(homeDiskUsedGB) < 0.5
      ? diskUsage
      : undefined; // 500MB

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
  const hideEdgeImpulse = appDetail?.example === true;
  const readOnly = !appId;

  const { data: brick } = useQuery({
    queryKey: ['get-brick-details', brickId],
    queryFn: () => getBrickDetails(brickId),
  });

  const { data: brickInstance } = useQuery({
    queryKey: ['get-brick-instance', brickId, appId],
    queryFn: () => getAppBrickInstance(appId ?? '', brickId),
    enabled: !!appDetail?.bricks?.find((b) => b.id === brickId),
  });

  const readme = useMemo(
    () => (brick?.readme?.trim().length ? brick.readme : null),
    [brick],
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
      .map((model) => ({
        id: model.id ?? '',
        name: model.name ?? '',
        description: model.description ?? '',
        source: 'edgeimpulse',
        url: model.metadata?.['ei-model-url'],
        isBuiltIn: !!model.is_builtin,
      }));

    if (hideEdgeImpulse) {
      return builtInModels;
    }

    // Remote edge impulse studio models
    const currentRemoteEdgeImpulseProject = getEIProjectsByBrickType(
      brick?.id ?? '',
    );
    const remoteEgeImpulseModels: BrickDetailModel[] =
      currentRemoteEdgeImpulseProject.map((project: EIProject) => {
        // If impulses are deleted from edge impulse studio,
        // but downloaded on the board, show them in the project
        const orphanImpulses = (installedModels || [])
          .filter(
            (model) =>
              model.metadata?.['ei-project-id'] === project.id.toString() &&
              !project.impulses?.find(
                (impulse) =>
                  impulse.id.toString() === model.metadata?.['ei-impulse-id'],
              ),
          )
          .map((model) => ({
            id: model.metadata?.['ei-impulse-id'] ?? '',
            name: model.metadata?.['ei-impulse-name'] ?? '',
            isInstalled: true,
            installedModelId: model?.id,
            isOutdated: false,
          }));

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

    // Show installed models which project has been deleted in edge impulse
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

      const impulse: BrickDetailModelImpulse = {
        id: m.metadata?.['ei-impulse-id'] ?? '',
        name: m.metadata?.['ei-impulse-name'] ?? '',
        isInstalled: true,
        installedModelId: m.id,
        isOutdated: false,
      };

      if (!acc[projectId]) {
        acc[projectId] = {
          id: projectId,
          name: m.name ?? '',
          description: m.description ?? '',
          isBuiltIn: false,
          source: 'edgeimpulse',
          edgeImpulseProps: { projectId, impulses: [] },
        };
      }
      acc[projectId].edgeImpulseProps!.impulses.push(impulse);
      return acc;
    }, {} as Record<string, BrickDetailModel>);

    return [
      ...builtInModels,
      ...remoteEgeImpulseModels,
      ...Object.values(orphanEdgeImpulseModels),
    ];
  }, [
    brick,
    getEIProjectsByBrickType,
    getInstalledModel,
    hideEdgeImpulse,
    installedModels,
    isModelOutdated,
  ]);

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
    [appId, brick?.name, brickId, brickInstance?.model, queryClient],
  );

  const downloadModel = useCallback(
    async (projectId: string, impulseId: string) => {
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
    [brick, brickId, readOnly, downloadImpulse, queryClient, updateModelInUse],
  );

  const removeModel = async (modelId: string): Promise<void> => {
    try {
      const modelName = getInstalledModel(modelId)?.name;
      await deleteAIModel(modelId);
      queryClient.setQueryData(
        ['get-installed-models'],
        (prev: AIModelItem[] | undefined) => {
          return prev?.filter((model) => model.id !== modelId);
        },
      );
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
        url = model?.url ?? '';
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
          }
        : undefined,
    [appId, brickInstance, configureDialogLogic, configureDialogOpen, readOnly],
  );

  const [trainNewModelDialogOpen, setTrainNewModelDialogOpen] = useState(false);
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

  return {
    brick,
    brickInstance,
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
    openExternalLink,
    openModelPage,
    onTrainNewModelClick,
    removeModel,
    downloadModel,
    getDownloadInfo,
    updateModelInUse,
  };
};

export const useConfigureAppBrickDialog: ConfigureAppBrickDialogLogic = (
  params,
) => {
  const { appId, brick, open } = params;

  const queryClient = useQueryClient();

  const confirmAction = useCallback(
    async (req: BrickCreateUpdateRequest): Promise<boolean> => {
      if (!brick.id) {
        console.error('Brick ID is required to update brick');
        return false;
      }
      const success = await updateAppBrick(appId, brick.id, req);
      if (success) {
        queryClient.invalidateQueries(['get-brick-instance', brick.id, appId]);
        queryClient.invalidateQueries(['app-bricks', appId]);
      }
      return success;
    },
    [appId, brick.id, queryClient],
  );

  const { data: brickInstance } = useQuery({
    queryKey: ['get-brick-instance', brick.id, appId],
    queryFn: () => getAppBrickInstance(appId ?? '', brick.id!),
    enabled: !!appId && !!brick.id && open,
  });

  return {
    brickInstance,
    confirmAction,
  };
};
