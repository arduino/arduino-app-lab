import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';
import {
  Action,
  ActionStatus,
  AddConsoleSource,
  AppendDataToSource,
  ConsoleSourceKey,
  ConsoleSources,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export type AppsStatus = {
  defaultApp?: AppDetailedInfo;
  runningApp?: AppDetailedInfo;
  activeApp?: AppDetailedInfo;
  failedApp?: AppDetailedInfo; // currently not used
};

export type RuntimeActions = {
  runAction: (
    app: AppDetailedInfo,
    displaySwapDialog?: (e: boolean) => void,
  ) => void;
  stopAction: (app: AppDetailedInfo) => void;
  swapAction: (app: AppDetailedInfo) => void;
  resetCurrentAction: () => void;
  currentAction: Action | null;
  currentActionStatus: ActionStatus;
  currentActionAppId?: string;
  progress: number; // currently not used
};

export type ConsoleLogic = {
  consoleSources: Record<string, ConsoleSources>;
  consoleTabs: Record<string, ConsoleSourceKey[]>;
  activeConsoleTab: Record<string, ConsoleSourceKey | undefined>;
  setActiveConsoleTab: (
    appId: string,
    tab: ConsoleSourceKey | undefined,
  ) => void;
  appendData: AppendDataToSource;
  addConsoleSource: AddConsoleSource;
  resetConsoleSources: (appId: string, keysToRetain: string[]) => void;
};

export type AiModelRequiredDialogState = {
  open: boolean;
  brickId?: string;
  modelId?: string;
};

export type AiModelRequired = {
  state: AiModelRequiredDialogState;
  open: (params: { brickId?: string; modelId?: string }) => void;
  close: () => void;
};

export type UseRuntimeLogic = () => {
  appsStatus: AppsStatus;
  runtimeActions: RuntimeActions;
  consoleLogic: ConsoleLogic;
  aiModelRequired: AiModelRequired;
};
