import { AppDetailedInfo, AppStatus } from '@cloud-editor-mono/infrastructure';
import { Subject } from 'rxjs';

import {
  AddConsoleSource,
  AppendDataToSource,
  ConsoleSources,
} from '../app-lab-multiple-console-panel';

export type RuntimeActionsLogic = () => {
  appId: string;
  appName?: string;
  appDefault?: AppDetailedInfo;
  appStatus: AppStatus;
  currentAction: AppLabAction | null;
  currentActionStatus: AppLabActionStatus;
  setAsDefaultApp?: (isSelected: boolean) => void;
  runApp: (appId: string) => void;
  stopApp: (appId: string, appStatus: AppStatus) => void;
  isBannerEnabled?: boolean;
  showStop?: boolean;
};

export interface RuntimeActionsProps<T extends string> {
  runtimeActionsLogic: RuntimeActionsLogic;
  setTab?: React.Dispatch<React.SetStateAction<T>>;
  runtimeDisable?: boolean;
  size?: 'small' | 'default';
}

export enum AppLabActionStatus {
  Errored = 'errored',
  Succeeded = 'succeeded',
  Pending = 'pending',
  Idle = 'idle',
}

export enum AppLabAction {
  Run = 'run',
  Stop = 'stop',
  Logs = 'logs',
}

export type UseRuntimeLogic = () => {
  defaultApp?: AppDetailedInfo;
  runningApp?: AppDetailedInfo;
  activeApp?: AppDetailedInfo;
  failedApp?: AppDetailedInfo;
  getAppStatusById: (appId: string) => AppStatus;
  runAction: (
    app: AppDetailedInfo,
    displaySwapDialog?: (e: boolean) => void,
  ) => void;
  consoleSourcesResetSubject: Subject<void>;
  consoleSources: ConsoleSources;
  stopAction: (app: AppDetailedInfo) => void;
  resetCurrentAction: () => void;
  currentAction: AppLabAction | null;
  currentActionStatus: AppLabActionStatus;
  swapAction: (app: AppDetailedInfo) => void;
  progress: number;
  consoleTabs: string[];
  activeConsoleTab?: string;
  setActiveConsoleTab: React.Dispatch<React.SetStateAction<string | undefined>>;
  appendData: AppendDataToSource;
  addConsoleSource: AddConsoleSource;
  resetConsoleSources: (keysToRetain: string[]) => void;
  consoleSourcesOwner?: string;
};
