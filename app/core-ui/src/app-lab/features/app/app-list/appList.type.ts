import { AppInfo } from '@cloud-editor-mono/infrastructure';
import {
  CreateAppDialogLogic,
  ImportAppDialogLogic,
  SnackbarProps,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseAppListLogic {
  apps: AppInfo[];
  isLoading: boolean;
  openCreateAppDialog: () => void;
  openImportAppDialog: () => void;
  createAppDialogLogic: CreateAppDialogLogic;
  importAppDialogLogic: ImportAppDialogLogic;
  importedAppId?: string;
  sendNotification: (props: Omit<SnackbarProps, 'onClose' | 'toastId'>) => void;
}
