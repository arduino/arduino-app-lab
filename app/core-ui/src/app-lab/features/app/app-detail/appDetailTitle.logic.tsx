import {
  cloneApp,
  deleteApp,
  exportApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  AppStatus,
  CloneAppRequest,
  UpdateAppDetailRequest,
} from '@cloud-editor-mono/infrastructure';
import {
  AppAction,
  AppTitleLogic,
  CreateAppDialogLogic,
  DeleteAppDialogLogic,
  ExportAppDialogLogic,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

import { DETAIL_PATH_BY_SECTION } from '../../../routes/__root';
import { sendAppLabNotification } from '../../notifications';
import { AppsSection } from '../app.type';
import { appDetailMessages as messages } from './messages';

export type UseCreateAppTitleLogic = (
  app: AppDetailedInfo | undefined,
  appStatus: AppStatus,
  section: AppsSection,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
) => AppTitleLogic;

const createSuccessfulExportMessage = (appName?: string): string =>
  appName ? `${appName} Correctly exported` : 'App correctly exported';

export const useCreateAppTitleLogic: UseCreateAppTitleLogic = function (
  app: AppDetailedInfo | undefined,
  appStatus: AppStatus,
  section: AppsSection,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
): AppTitleLogic {
  const navigate = useNavigate({
    from: DETAIL_PATH_BY_SECTION[section || 'examples'],
  });

  const { formatMessage } = useI18n();

  const [deleteAppDialogOpen, setDeleteAppDialogOpen] = useState(false);
  const [createAppDialogOpen, setCreateAppDialogOpen] = useState(false);
  const [exportAppDialogOpen, setExportAppDialogOpen] = useState(false);
  const [name, setName] = useState(app?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const useDeleteAppDialogLogic = (): ReturnType<DeleteAppDialogLogic> => {
    const { mutateAsync: handleDeleteApp } = useMutation({
      mutationFn: async (): Promise<boolean> => {
        if (!app) return false;

        const result = await deleteApp(app.id);
        if (result) {
          navigate({
            to: `/${section}`,
          });
          sendAppLabNotification({
            message: formatMessage(messages.successfullyDeletedApp),
            variant: 'success',
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
    formatMessage,
    navigate,
    section,
  ]);

  const useCreateAppDialogLogic = (): ReturnType<CreateAppDialogLogic> => {
    const { mutateAsync: handleCloneApp } = useMutation({
      mutationFn: async (request: CloneAppRequest): Promise<boolean> => {
        if (!app) return false;
        const result = await cloneApp(app.id, request);
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
      app,
      confirmAction: handleCloneApp,
      onOpenChange: setCreateAppDialogOpen,
      sendNotification: sendAppLabNotification,
    };
  };
  const createAppDialogLogic = useCallback(useCreateAppDialogLogic, [
    app,
    createAppDialogOpen,
    navigate,
  ]);

  const useExportAppDialogLogic = (): ReturnType<ExportAppDialogLogic> => {
    const {
      mutate: onExport,
      isLoading,
      error,
      reset,
    } = useMutation({
      mutationFn: async (includeData: boolean) => {
        if (!app) return false;

        const result = await exportApp(app.id, app.name, includeData);
        return result;
      },
      onSuccess: (result) => {
        if (!result) {
          return;
        }
        setExportAppDialogOpen(false);
        sendAppLabNotification({
          message: createSuccessfulExportMessage(app?.name),
          variant: 'success',
        });
      },
    });

    return {
      open: exportAppDialogOpen,
      appName: [app?.icon, app?.name].join(' '),
      onExport,
      onOpenChange: setExportAppDialogOpen,
      isLoading,
      error,
      reset,
    };
  };
  const exportAppDialogLogic = useCallback(useExportAppDialogLogic, [
    app,
    exportAppDialogOpen,
  ]);

  const onAppNameChange = useCallback((value: string): void => {
    setName(value);
    setHasError(false);
  }, []);

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

      case AppAction.Export:
        setExportAppDialogOpen(true);
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
    if (!updateApp) return;
    const result = await updateApp({
      name,
    });
    if (result) {
      setEditing(false);
    } else {
      setHasError(true);
    }
  }, [updateApp, name]);

  const onUpdateAppIcon = useCallback(
    async (emoji: string): Promise<boolean> => {
      if (!updateApp) return false;
      return updateApp({
        icon: emoji,
      });
    },
    [updateApp],
  );

  const appTitleLogic: AppTitleLogic = useCallback(
    () => ({
      app,
      appStatus,
      name,
      editing,
      hasError,
      onAppNameChange,
      onAppAction,
      onResetAppName,
      onRenameApp,
      onUpdateAppIcon,
      deleteAppDialogLogic,
      createAppDialogLogic,
      exportAppDialogLogic,
    }),
    [
      app,
      appStatus,
      createAppDialogLogic,
      deleteAppDialogLogic,
      exportAppDialogLogic,
      editing,
      hasError,
      name,
      onAppNameChange,
      onAppAction,
      onRenameApp,
      onResetAppName,
      onUpdateAppIcon,
    ],
  );

  return appTitleLogic;
};
