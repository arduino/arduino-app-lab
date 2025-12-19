import {
  cloneApp,
  deleteApp,
  updateAppDetail,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  CloneAppRequest,
  UpdateAppDetailRequest,
} from '@cloud-editor-mono/infrastructure';
import {
  AppAction,
  AppTitleLogic,
  CreateAppDialogLogic,
  DeleteAppDialogLogic,
  UseCreateAppTitleLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppsSection, DETAIL_PATH_BY_SECTION } from '../../routes/__root';

export const useCreateAppTitleLogic: UseCreateAppTitleLogic = function (
  app: AppDetailedInfo | undefined,
  section?: string,
  reloadApp?: () => void,
): AppTitleLogic {
  const redirectSection = !!section;
  const navigate = useNavigate({
    from: DETAIL_PATH_BY_SECTION[(section as AppsSection) || 'examples'],
  });

  const [deleteAppDialogOpen, setDeleteAppDialogOpen] = useState(false);
  const [createAppDialogOpen, setCreateAppDialogOpen] = useState(false);
  const [name, setName] = useState(app?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const queryClient = useQueryClient();

  const useDeleteAppDialogLogic = (): ReturnType<DeleteAppDialogLogic> => {
    const { mutateAsync: handleDeleteApp } = useMutation({
      mutationFn: async (): Promise<boolean> => {
        if (!app) return false;

        const result = await deleteApp(app.id);
        if (result && redirectSection) {
          navigate({
            to: `/${section}`,
          });
        }
        return result;
      },
    });

    return {
      open: deleteAppDialogOpen,
      appName: [app?.icon, app?.name].join(' '),
      confirmAction: handleDeleteApp,
      onOpenChange: setDeleteAppDialogOpen,
    };
  };
  const deleteAppDialogLogic = useCallback(useDeleteAppDialogLogic, [
    app,
    deleteAppDialogOpen,
    navigate,
    redirectSection,
    section,
  ]);

  const useCreateAppDialogLogic = (): ReturnType<CreateAppDialogLogic> => {
    const { mutateAsync: handleCloneApp } = useMutation({
      mutationFn: async (request: CloneAppRequest): Promise<boolean> => {
        if (!app) return false;
        const result = await cloneApp(app.id, request);
        if (result && redirectSection) {
          navigate({
            to: `/my-apps/${result}`,
          });
        }
        return result !== undefined;
      },
    });

    return {
      open: createAppDialogOpen,
      app,
      confirmAction: handleCloneApp,
      onOpenChange: setCreateAppDialogOpen,
    };
  };
  const createAppDialogLogic = useCallback(useCreateAppDialogLogic, [
    app,
    createAppDialogOpen,
    navigate,
    redirectSection,
  ]);

  const { mutateAsync: handleUpdateApp } = useMutation({
    mutationFn: async (request: UpdateAppDetailRequest): Promise<boolean> => {
      if (!app) return false;
      const result = await updateAppDetail(app.id, request);
      if (result === app.id) {
        reloadApp && reloadApp();

        if (Object.hasOwn(request, 'default')) {
          queryClient.invalidateQueries({
            queryKey: ['get-default-app'],
            exact: true,
          });
        }
      } else if (result !== undefined && redirectSection) {
        navigate({
          to: `/${section}/${result}`,
        });
      }
      return result !== undefined;
    },
  });

  const onAppNameChange = useCallback((value: string): void => {
    setName(value);
    setHasError(false);
  }, []);

  const onAppDefaultChange = useMemo(
    () =>
      async (isSelected: boolean): Promise<void> => {
        await handleUpdateApp({
          default: isSelected,
        });
      },
    [handleUpdateApp],
  );

  useEffect((): void => {
    setName(app?.name || '');
  }, [app?.name]);

  const onAppAction = useCallback((action: AppAction): void => {
    switch (action) {
      case AppAction.Rename:
        setEditing(true);
        break;

      case AppAction.Duplicate:
        setCreateAppDialogOpen(true);
        break;

      case AppAction.Delete:
        setDeleteAppDialogOpen(true);
        break;
    }
  }, []);

  const onResetAppName = useCallback((): void => {
    setEditing(false);
    setHasError(false);
    setName(app?.name ?? '');
  }, [app?.name]);

  const onRenameApp = useCallback(async (): Promise<void> => {
    const result = await handleUpdateApp({
      name,
    });
    if (result) {
      setEditing(false);
    } else {
      setHasError(true);
    }
  }, [handleUpdateApp, name]);

  const onUpdateAppIcon = useCallback(
    async (emoji: string): Promise<boolean> =>
      handleUpdateApp({
        icon: emoji,
      }),
    [handleUpdateApp],
  );

  const appTitleLogic: AppTitleLogic = useCallback(
    () => ({
      app,
      name,
      editing,
      hasError,
      onAppDefaultChange,
      onAppNameChange,
      onAppAction,
      onResetAppName,
      onRenameApp,
      onUpdateAppIcon,
      deleteAppDialogLogic,
      createAppDialogLogic,
    }),
    [
      app,
      createAppDialogLogic,
      deleteAppDialogLogic,
      editing,
      hasError,
      name,
      onAppDefaultChange,
      onAppNameChange,
      onAppAction,
      onRenameApp,
      onResetAppName,
      onUpdateAppIcon,
    ],
  );

  return appTitleLogic;
};
