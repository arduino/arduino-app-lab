import { getApps } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useBoardLifecycleStore } from '../../../store/boardLifecycle';
import { sendAppLabNotification } from '../../notifications';
import { AppsSection } from '../app.type';
import { UseAppListLogic } from './appList.type';
import { ImportStatus } from './importAppDialog.type';
import { useCreateAppDialogLogic } from './useCreateAppDialogLogic';
import { useImportAppDialogLogic } from './useImportAppDialogLogic';

export const useAppListLogic = function (
  section: AppsSection,
): UseAppListLogic {
  const [createAppDialogOpen, setCreateAppDialogOpen] = useState(false);
  const [importAppDialogOpen, setImportAppDialogOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>(
    ImportStatus.Idle,
  );
  const [importErrorMessage, setImportErrorMessage] = useState<
    string | undefined
  >();
  const [importedAppId, setImportedAppId] = useState<string | undefined>();

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const { data: apps, isLoading: getAppsLoading } = useQuery(
    ['list-my-apps', section],
    () => {
      return getApps({
        query: { filter: section === 'my-apps' ? 'apps' : 'examples' },
      });
    },
    {
      enabled: boardIsReachable,
    },
  );

  const handleOpenCreateAppDialog = useCallback(() => {
    setCreateAppDialogOpen(true);
  }, []);

  const handleOpenImportAppDialog = useCallback(() => {
    setImportAppDialogOpen(true);
  }, []);

  const createAppDialogLogic = useCreateAppDialogLogic(
    createAppDialogOpen,
    setCreateAppDialogOpen,
  );

  const importAppDialogLogic = useImportAppDialogLogic(
    importAppDialogOpen,
    setImportAppDialogOpen,
    importStatus,
    setImportStatus,
    importErrorMessage,
    setImportErrorMessage,
    setImportedAppId,
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
  };
};
