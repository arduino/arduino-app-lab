import {
  createApp,
  getApps,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { CreateAppRequest } from '@cloud-editor-mono/infrastructure';
import { CreateAppDialogLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

import { AppsSection } from '../../routes/__root';
import { useBoardLifecycleStore } from '../../store/boards/boards';
import { UseAppListLogic } from './appList.type';

export const useAppListLogic = function (
  section: AppsSection,
): UseAppListLogic {
  const [createAppDialogOpen, setCreateAppDialogOpen] = useState(false);
  const navigate = useNavigate({ from: `/${section}` });

  const { boardIsReachable } = useBoardLifecycleStore();
  const { data: apps, isLoading: getAppsLoading } = useQuery(
    ['list-my-apps', section, boardIsReachable],
    () => {
      return getApps({
        query: { filter: section === 'my-apps' ? 'apps' : 'examples' },
      });
    },
    {
      enabled: boardIsReachable,
      refetchOnWindowFocus: false,
    },
  );

  const handleOpenCreateAppDialog = useCallback(() => {
    setCreateAppDialogOpen(true);
  }, []);

  const useCreateAppDialogLogic = (): ReturnType<CreateAppDialogLogic> => {
    const { mutateAsync: handleCreateApp } = useMutation({
      mutationFn: async (request: CreateAppRequest): Promise<boolean> => {
        const result = await createApp(request);
        if (result) {
          navigate({
            to: `/my-apps/${result}`,
          });
        }
        return result !== undefined;
      },
    });

    return {
      open: createAppDialogOpen,
      confirmAction: handleCreateApp,
      onOpenChange: setCreateAppDialogOpen,
    };
  };

  const createAppDialogLogic = useCallback(useCreateAppDialogLogic, [
    createAppDialogOpen,
    navigate,
  ]);

  return {
    apps: apps || [],
    isLoading: getAppsLoading,
    createAppDialogLogic,
    openCreateAppDialog: handleOpenCreateAppDialog,
  };
};
