import { AppDetailedInfo, AppStatus } from '@cloud-editor-mono/infrastructure';

import {
  CreateAppDialogLogic,
  DeleteAppDialogLogic,
  ExportAppDialogLogic,
} from '../../../dialogs';

export enum AppAction {
  Rename = 'RENAME',
  Duplicate = 'DUPLICATE',
  Export = 'Export',
  Delete = 'DELETE',
}

export type AppTitleLogic = () => {
  app: AppDetailedInfo | undefined;
  appStatus?: AppStatus;
  name: string;
  editing: boolean;
  hasError: boolean;
  onAppNameChange: (value: string) => void;
  onAppAction: (action: AppAction) => void;
  onResetAppName: () => void;
  onRenameApp: () => void;
  onUpdateAppIcon: (emoji: string) => Promise<boolean>;
  deleteAppDialogLogic: DeleteAppDialogLogic;
  createAppDialogLogic: CreateAppDialogLogic;
  exportAppDialogLogic: ExportAppDialogLogic;
};
