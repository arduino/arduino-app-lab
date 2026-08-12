import { AppInfo } from '@cloud-editor-mono/infrastructure';
import {
  CreateAppDialogLogic,
  DeleteAppDialogLogic,
  ExportAppDialogLogic,
  RenameAppDialogLogic,
  SnackbarProps,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import React from 'react';

export interface AppActions {
  onRename: (app: AppInfo) => void;
  onDuplicate: (app: AppInfo) => void;
  onExport: (app: AppInfo) => void;
  onSetAsDefault: (app: AppInfo) => void;
  onDelete: (app: AppInfo) => void;
}

export interface UseAppListLogic {
  apps: AppInfo[];
  isLoading: boolean;
  openCreateAppDialog: () => void;
  openImportAppDialog: () => void;
  importedAppId?: string;
  sendNotification: (props: Omit<SnackbarProps, 'onClose' | 'toastId'>) => void;
  appActions: AppActions;
  deleteAppDialogLogic: DeleteAppDialogLogic;
  duplicateAppDialogLogic: CreateAppDialogLogic;
  renameAppDialogLogic: RenameAppDialogLogic;
  exportAppDialogLogic: ExportAppDialogLogic;
  defaultApp?: AppInfo;
  handleAppClick: (appId: string, e?: React.MouseEvent) => void;
}
