import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';
import {
  AiModelRequiredDialogLogic,
  AppAction,
  AppLabEditSectionLogic,
  AppTitleLogic,
  ConfigureAppBricksDialogLogic,
  DeleteTreeItemDialogLogic,
  RuntimeActionsLogic,
  SwapRunningAppDialogLogic,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export type AppsSection = 'my-apps' | 'examples';

export type AppLabAppDetailLogic = (
  appId: string,
  section: AppsSection,
) => {
  app?: AppDetailedInfo;
  fileTree?: TreeNode[];
  activePanel: 'editor' | 'console';
  configureAppBricksDialogLogic: ConfigureAppBricksDialogLogic;
  swapRunningAppDialogLogic: SwapRunningAppDialogLogic;
  aiModelRequiredDialogLogic: AiModelRequiredDialogLogic;
  onAppAction: (action: AppAction) => void;
  appTitleLogic: AppTitleLogic;
  appLabEditSectionLogic: AppLabEditSectionLogic;
  runtimeActionsLogic: RuntimeActionsLogic;
  updateOpenFile: (currFileId: string, nextFileId: string) => void;
  deleteTreeItemDialogLogic: DeleteTreeItemDialogLogic;
};
