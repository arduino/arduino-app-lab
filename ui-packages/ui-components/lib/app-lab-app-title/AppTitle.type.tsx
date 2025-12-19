import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';

import { CreateAppDialogLogic, DeleteAppDialogLogic } from '../dialogs';

export enum AppAction {
  Rename = 'RENAME',
  Duplicate = 'DUPLICATE',
  Delete = 'DELETE',
}

export type AppTitleLogic = () => {
  app: AppDetailedInfo | undefined;
  name: string;
  editing: boolean;
  hasError: boolean;
  onAppDefaultChange?: (isSelected: boolean) => Promise<void>;
  onAppNameChange: (value: string) => void;
  onAppAction: (action: AppAction) => void;
  onResetAppName: () => void;
  onRenameApp: () => void;
  onUpdateAppIcon: (emoji: string) => Promise<boolean>;
  deleteAppDialogLogic: DeleteAppDialogLogic;
  createAppDialogLogic: CreateAppDialogLogic;
};

export type UseCreateAppTitleLogic = (
  app: AppDetailedInfo | undefined,
  section?: string,
  reloadApp?: () => void,
) => AppTitleLogic;
