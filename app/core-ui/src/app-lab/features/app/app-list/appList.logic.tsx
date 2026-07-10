import {
  cloneApp,
  deleteApp,
  exportApp,
  getApps,
  selectAppPathToImport,
  updateAppDetail,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { importAppFromPath } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { AppDetailedInfo, AppInfo } from '@cloud-editor-mono/infrastructure';
import {
  AppsSection,
  CreateAppDialogLogic,
  DeleteAppDialogLogic,
  ExportAppDialogLogic,
  RenameAppDialogLogic,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { useImportResource } from '../../../hooks/useImportResource';
import { useBoardLifecycleStore } from '../../../store/boardLifecycle';
import { sendAppLabNotification } from '../../notifications';
import { UseAppListLogic } from './appList.type';
import { appListMessages } from './messages';
import { useCreateAppDialogLogic } from './useCreateAppDialogLogic';

export const useAppListLogic = function (
  section: AppsSection,
): UseAppListLogic {
  const navigate = useNavigate();
  const { formatMessage } = useI18n();

  const [createAppDialogOpen, setCreateAppDialogOpen] = useState(false);
  const [importAppDialogOpen, setImportAppDialogOpen] = useState(false);
  const [importedAppId, setImportedAppId] = useState<string | undefined>();
  const [deleteAppDialogOpen, setDeleteAppDialogOpen] = useState(false);
  const [duplicateAppDialogOpen, setDuplicateAppDialogOpen] = useState(false);
  const [renameAppDialogOpen, setRenameAppDialogOpen] = useState(false);
  const [exportAppDialogOpen, setExportAppDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null);

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const { data: apps, isLoading: getAppsLoading } = useQuery(
    ['list-my-apps', section],
    () =>
      getApps({
        query: { filter: section === 'my-apps' ? 'apps' : 'examples' },
      }),
    { enabled: boardIsReachable },
  );

  const defaultApp = useMemo(() => apps?.find((app) => app.default), [apps]);

  const handleOpenCreateAppDialog = useCallback(() => {
    setCreateAppDialogOpen(true);
  }, []);

  const handleOpenImportAppDialog = useCallback(() => {
    setImportAppDialogOpen(true);
  }, []);

  const resetImportedAppId = useCallback(() => {
    setImportedAppId(undefined); // Reset importedAppId to prevent ripple retrigger
  }, []);

  const createAppActionHandler = useCallback(
    (dialogSetter: (open: boolean) => void, action?: () => void) =>
      (app: AppInfo) => {
        setSelectedApp(app);
        dialogSetter(true);
        resetImportedAppId();
        action?.();
      },
    [resetImportedAppId],
  );

  const handleRename = useCallback(
    (app: AppInfo) => createAppActionHandler(setRenameAppDialogOpen)(app),
    [createAppActionHandler],
  );

  const handleDuplicate = useCallback(
    (app: AppInfo) => createAppActionHandler(setDuplicateAppDialogOpen)(app),
    [createAppActionHandler],
  );

  const handleDelete = useCallback(
    (app: AppInfo) => createAppActionHandler(setDeleteAppDialogOpen)(app),
    [createAppActionHandler],
  );

  const handleExport = useCallback(
    (app: AppInfo) => createAppActionHandler(setExportAppDialogOpen)(app),
    [createAppActionHandler],
  );

  const { mutateAsync: handleSetAsDefault } = useMutation({
    mutationFn: async (app: AppInfo) => {
      if (!app.id) return false;
      const result = await updateAppDetail(app.id, {
        default: defaultApp?.id !== app.id,
      });
      if (result) {
        sendAppLabNotification({
          message: formatMessage(
            defaultApp?.id === app.id
              ? appListMessages.removedAsDefault
              : appListMessages.setAsDefault,
            { appName: app.name },
          ),
          variant: 'success',
        });
      }
      return result !== undefined;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-my-apps', section] });
    },
  });

  const appActions = useCallback(
    () => ({
      onRename: handleRename,
      onDuplicate: handleDuplicate,
      onExport: handleExport,
      onSetAsDefault: handleSetAsDefault,
      onDelete: handleDelete,
    }),
    [
      handleRename,
      handleDuplicate,
      handleExport,
      handleSetAsDefault,
      handleDelete,
    ],
  );

  const handleAppClick = useCallback(
    (appId: string, e?: React.MouseEvent) => {
      if (e) {
        const target = e.target as HTMLElement;
        const isContextMenu =
          target.closest('[data-radix-context-menu-content]') !== null;
        if (isContextMenu) return;
      }

      navigate({
        to: `/${section}/$appId`,
        params: { appId },
      });
    },
    [navigate, section],
  );

  const createAppDialogLogic = useCreateAppDialogLogic(
    createAppDialogOpen,
    setCreateAppDialogOpen,
  );

  const importAppDialogLogic = useImportResource({
    importResourceDialogOpen: importAppDialogOpen,
    setImportResourceDialogOpen: setImportAppDialogOpen,
    setImportedResourceId: setImportedAppId,
    selectResourcePath: selectAppPathToImport,
    importResourceFromPath: (filePath: string) => importAppFromPath(filePath),
    type: 'app',
    invalidateQueries: () => {
      queryClient.invalidateQueries(['list-my-apps']);
    },
  });

  const { mutateAsync: handleDeleteApp } = useMutation({
    mutationFn: async (): Promise<boolean> => {
      if (!selectedApp?.id) return false;
      const result = await deleteApp(selectedApp.id);
      if (result) {
        sendAppLabNotification({
          message: formatMessage(appListMessages.successfullyDeletedApp),
          variant: 'success',
          duration: 3000,
        });
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-my-apps', section] });
    },
  });

  const deleteAppDialogLogic = useCallback(
    (): ReturnType<DeleteAppDialogLogic> => ({
      open: deleteAppDialogOpen,
      appName: selectedApp
        ? [selectedApp.icon, selectedApp.name].join(' ')
        : '',
      confirmAction: handleDeleteApp,
      onOpenChange: setDeleteAppDialogOpen,
    }),
    [deleteAppDialogOpen, selectedApp, handleDeleteApp],
  );

  const { mutateAsync: handleCloneApp } = useMutation({
    mutationFn: async (request: {
      icon?: string;
      name: string;
    }): Promise<boolean> => {
      if (!selectedApp?.id) return false;
      const result = await cloneApp(selectedApp.id, request);
      if (result) {
        navigate({ to: `/my-apps/${result}` });
      }
      return result !== undefined;
    },
  });

  const duplicateAppDialogLogic = useCallback(
    (): ReturnType<CreateAppDialogLogic> => ({
      open: duplicateAppDialogOpen,
      app: selectedApp as AppDetailedInfo | undefined,
      confirmAction: handleCloneApp,
      onOpenChange: setDuplicateAppDialogOpen,
      sendNotification: sendAppLabNotification,
    }),
    [duplicateAppDialogOpen, selectedApp, handleCloneApp],
  );

  const { mutateAsync: handleRenameApp } = useMutation({
    mutationFn: async (request: {
      icon?: string;
      name: string;
    }): Promise<boolean> => {
      if (!selectedApp?.id) return false;
      const result = await updateAppDetail(selectedApp.id, request);
      return result !== undefined;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-my-apps', section] });
    },
  });

  const renameAppDialogLogic = useCallback(
    (): ReturnType<RenameAppDialogLogic> => ({
      open: renameAppDialogOpen,
      app: selectedApp as AppDetailedInfo | undefined,
      confirmAction: handleRenameApp,
      onOpenChange: setRenameAppDialogOpen,
      sendNotification: sendAppLabNotification,
    }),
    [renameAppDialogOpen, selectedApp, handleRenameApp],
  );

  const {
    mutate: onExport,
    isLoading: exportLoading,
    error: exportError,
    reset: exportReset,
  } = useMutation({
    mutationFn: async (includeData: boolean) => {
      if (!selectedApp?.id || !selectedApp.name) return false;

      return exportApp(selectedApp.id, selectedApp.name, includeData);
    },
    onSuccess: (result) => {
      if (result) {
        setExportAppDialogOpen(false);
        sendAppLabNotification({
          message: formatMessage(appListMessages.successfullyExportedApp, {
            appName: selectedApp?.name,
          }),
          variant: 'success',
        });
      }
    },
  });

  const exportAppDialogLogic = useCallback(
    (): ReturnType<ExportAppDialogLogic> => ({
      open: exportAppDialogOpen,
      appName: selectedApp
        ? [selectedApp.icon, selectedApp.name].join(' ')
        : '',
      onExport,
      onOpenChange: setExportAppDialogOpen,
      isLoading: exportLoading,
      error: exportError,
      reset: exportReset,
    }),
    [
      exportAppDialogOpen,
      selectedApp,
      onExport,
      exportLoading,
      exportError,
      exportReset,
    ],
  );

  return {
    apps: apps || [],
    isLoading: getAppsLoading,
    sendNotification: sendAppLabNotification,
    openCreateAppDialog: handleOpenCreateAppDialog,
    openImportAppDialog: handleOpenImportAppDialog,
    createAppDialogLogic,
    importAppDialogLogic,
    importedAppId,
    appActions: appActions(),
    deleteAppDialogLogic,
    duplicateAppDialogLogic,
    renameAppDialogLogic,
    exportAppDialogLogic,
    defaultApp,
    handleAppClick,
  };
};
