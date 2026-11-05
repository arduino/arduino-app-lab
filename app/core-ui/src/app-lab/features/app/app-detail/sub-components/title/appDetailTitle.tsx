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
  AppsSection,
  AppTitleLogic,
  CreateAppDialogLogic,
  DeleteAppDialogLogic,
  ExportAppDialogLogic,
  PublishAppDialogLogic,
  ReleaseInfoDialogLogic,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useContext, useEffect, useState } from 'react';

import { AuthContext } from '../../../../../providers/auth/authContext';
import { PublishContext } from '../../../../../providers/publish/publishContext';
import { DETAIL_PATH_BY_SECTION } from '../../../../../routes/__root';
import { removeOpenFilesForApp } from '../../../../../services/openFilesStore';
import { useBoardLifecycleStore } from '../../../../../store/boardLifecycle';
import { sendAppLabNotification } from '../../../../notifications';
import { releaseInfoDetails } from '../../../../release/releaseApp';
import { useCreateReleaseTrigger } from '../../../../release/releaseDialogs.logic';
import { messages } from '../../messages';

export type UseCreateAppTitleLogic = (
  app: AppDetailedInfo | undefined,
  appStatus: AppStatus,
  section: AppsSection,
  defaultApp?: AppDetailedInfo,
  setAsDefaultApp?: (isSelected: boolean) => Promise<void>,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
  openApp?: (app: AppDetailedInfo) => void,
) => AppTitleLogic;

const createSuccessfulExportMessage = (appName?: string): string =>
  appName ? `${appName} Correctly exported` : 'App correctly exported';

export const useCreateAppTitleLogic: UseCreateAppTitleLogic = function (
  app: AppDetailedInfo | undefined,
  appStatus: AppStatus,
  section: AppsSection,
  defaultApp?: AppDetailedInfo,
  setAsDefaultApp?: (isSelected: boolean) => Promise<void>,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
  openApp?: (app: AppDetailedInfo) => void,
): AppTitleLogic {
  const navigate = useNavigate({
    from: DETAIL_PATH_BY_SECTION[section || 'examples'],
  });

  const { formatMessage } = useI18n();

  const [deleteAppDialogOpen, setDeleteAppDialogOpen] = useState(false);
  const [createAppDialogOpen, setCreateAppDialogOpen] = useState(false);
  const [exportAppDialogOpen, setExportAppDialogOpen] = useState(false);
  const [publishAppDialogOpen, setPublishAppDialogOpen] = useState(false);
  const [releaseInfoDialogOpen, setReleaseInfoDialogOpen] = useState(false);
  const [name, setName] = useState(app?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const useDeleteAppDialogLogic = (): ReturnType<DeleteAppDialogLogic> => {
    const { mutateAsync: handleDeleteApp } = useMutation({
      mutationFn: async (): Promise<boolean> => {
        if (!app) return false;

        const result = await deleteApp(app.id);
        if (result) {
          const serial =
            useBoardLifecycleStore.getState().selectedConnectedBoard?.serial;
          await removeOpenFilesForApp(app.id, serial);
          navigate({
            to: `/${section}`,
            params: true,
          });
          sendAppLabNotification({
            message: formatMessage(messages.successfullyDeletedApp),
            variant: 'success',
            duration: 3000,
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
            params: true,
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

  const usePublishAppDialogLogic = (): ReturnType<PublishAppDialogLogic> => {
    const { user: arduinoUser, login: arduinoLogin } = useContext(AuthContext);
    const { startPublish } = useContext(PublishContext);
    const [isSigningIn, setIsSigningIn] = useState(false);

    return {
      open: publishAppDialogOpen,
      onPublish: async (includeData: boolean): Promise<void> => {
        if (!app) return;

        if (!arduinoUser) {
          setIsSigningIn(true);
          try {
            await arduinoLogin();
          } catch (error) {
            console.error('Arduino sign-in failed:', error);
            return;
          } finally {
            setIsSigningIn(false);
          }
        }

        setPublishAppDialogOpen(false);
        startPublish(app, includeData);
      },
      onOpenChange: setPublishAppDialogOpen,
      isLoading: isSigningIn,
    };
  };
  const publishAppDialogLogic = useCallback(usePublishAppDialogLogic, [
    app,
    publishAppDialogOpen,
  ]);

  const releaseInfoDialogLogic = useCallback(
    (): ReturnType<ReleaseInfoDialogLogic> => ({
      open: releaseInfoDialogOpen,
      release: app ? releaseInfoDetails(app) : undefined,
      onOpenChange: setReleaseInfoDialogOpen,
    }),
    [app, releaseInfoDialogOpen],
  );

  const useExportAppDialogLogic = (): ReturnType<ExportAppDialogLogic> => {
    const {
      mutate: onExport,
      isPending,
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
      isLoading: isPending,
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

  const { openCreateRelease, disabledReason } = useCreateReleaseTrigger();
  const createReleaseDisabledReason = disabledReason(app?.id);

  const onAppAction = useCallback(
    (action: AppAction): void => {
      switch (action) {
        case AppAction.Rename:
          setEditing(true);
          break;

        case AppAction.Duplicate:
          setCreateAppDialogOpen(true);
          break;

        case AppAction.Publish:
          setPublishAppDialogOpen(true);
          break;

        case AppAction.CreateRelease:
          if (app) openCreateRelease(app);
          break;

        case AppAction.ReleaseInfo:
          setReleaseInfoDialogOpen(true);
          break;

        case AppAction.Export:
          setExportAppDialogOpen(true);
          break;

        case AppAction.Delete:
          setDeleteAppDialogOpen(true);
          break;
      }
    },
    [app, openCreateRelease],
  );

  const onResetAppName = useCallback((): void => {
    setEditing(false);
    setHasError(false);
    setName(app?.name ?? '');
  }, [app?.name]);

  const onRenameApp = useCallback(async (): Promise<void> => {
    if (!updateApp) {
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      onResetAppName();
      return;
    }
    const result = await updateApp({
      name: trimmedName,
    });
    if (result) {
      setName(trimmedName);
      setEditing(false);
    } else {
      setHasError(true);
    }
  }, [updateApp, name, onResetAppName]);

  const onUpdateAppIcon = useCallback(
    async (emoji: string): Promise<boolean> => {
      if (!updateApp) return false;
      return updateApp({
        icon: emoji,
      });
    },
    [updateApp],
  );

  return useCallback(
    () => ({
      app,
      appStatus,
      createReleaseDisabledReason,
      name,
      editing,
      hasError,
      defaultApp,
      setAsDefaultApp,
      openApp,
      onAppNameChange,
      onAppAction,
      onResetAppName,
      onRenameApp,
      onUpdateAppIcon,
      deleteAppDialogLogic,
      createAppDialogLogic,
      exportAppDialogLogic,
      publishAppDialogLogic,
      releaseInfoDialogLogic,
    }),
    [
      app,
      appStatus,
      createReleaseDisabledReason,
      name,
      editing,
      hasError,
      defaultApp,
      setAsDefaultApp,
      openApp,
      onAppNameChange,
      onAppAction,
      onResetAppName,
      onRenameApp,
      onUpdateAppIcon,
      deleteAppDialogLogic,
      createAppDialogLogic,
      exportAppDialogLogic,
      publishAppDialogLogic,
      releaseInfoDialogLogic,
    ],
  );
};
