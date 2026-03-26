import { Config } from '@cloud-editor-mono/common';
import {
  getAIModels,
  getEIProjects,
  installEIModel,
  isEIDeploymentOutdated,
  openLinkExternal,
  setEILatencyDevice,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { AIModelItem, EIProject } from '@cloud-editor-mono/infrastructure';
import { ModelDownloadInfo } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { sendAppLabNotification } from '../../features/notifications';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { EdgeImpulseContext } from '../edge-impulse/edgeImpulseContext';
import { EdgeImpulseModelsContextValue } from './edgeImpulseModelsContext';
import { isCompatibleEICategory, mapProjectToModel } from './utils';

export type UseEdgeImpulseParams = {
  enabled?: boolean;
};
const CHECK_STORAGE_KEY = 'ei_project_association_check_performed';

export function useEdgeImpulseModelsLogic(
  _params: UseEdgeImpulseParams = {},
): EdgeImpulseModelsContextValue {
  const [enableEdgeImpulseAutoRefresh, setEnableEdgeImpulseAutoRefresh] =
    useState(false);

  const [currentDownloads, setCurrentDownloads] = useState<{
    [projectId: string]: ModelDownloadInfo;
  } | null>(null);

  const { isAuthenticated } = useContext(EdgeImpulseContext);

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
  const installedModelsLookup = useMemo(
    () =>
      installedModels?.reduce(
        (lookup, model) => ({ ...lookup, [model.id ?? 'none']: model }),
        {} as { [key: string]: AIModelItem },
      ),
    [installedModels],
  );

  const outdatedModelsQueryKey = useMemo(
    () => ['outdated-models', { projects, installedModels }],
    [installedModels, projects],
  );
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

  const getInstalledModel = useCallback(
    (modelId: string, impulseId?: string) => {
      const id = impulseId ? `ei-model-${modelId}-${impulseId}` : modelId;
      return installedModelsLookup?.[id];
    },
    [installedModelsLookup],
  );

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

  const downloadImpulse = useCallback(
    async (projectId: string, impulseId: string): Promise<AIModelItem> => {
      if (currentDownloads?.[projectId]?.isDownloading) {
        throw Error('Already downloading a model from this project');
      }

      const updateDownload = (info: Partial<ModelDownloadInfo>): void =>
        setCurrentDownloads((prev) => ({
          ...(prev || {}),
          [projectId]: {
            ...(prev || {})[projectId],
            ...info,
          },
        }));

      let item: AIModelItem;
      try {
        updateDownload({
          impulseId,
          error: false,
          success: false,
          isDownloading: true,
        });
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
        updateDownload({ isDownloading: false, success: true });
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
        updateDownload({ isDownloading: false, error: true });

        return Promise.reject(error);
      }

      return item;
    },
    [
      currentDownloads,
      installedModelsQueryKey,
      outdatedModelsQueryKey,
      queryClient,
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
  };
}
