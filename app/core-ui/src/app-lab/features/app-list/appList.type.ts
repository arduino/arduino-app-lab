import { AppInfo } from '@cloud-editor-mono/infrastructure';
import { CreateAppDialogLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseAppListLogic {
  apps: AppInfo[];
  isLoading: boolean;
  openCreateAppDialog: () => void;
  createAppDialogLogic: CreateAppDialogLogic;
}
