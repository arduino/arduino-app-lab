import { ErrorData, MessageData } from '@cloud-editor-mono/infrastructure';
import { BehaviorSubject, Subject } from 'rxjs';

import { SerialMonitorLogic } from '../../../serial-monitor';
import { Board } from '../setup';

export interface ConsoleLogValue {
  value: string;
  meta?: {
    id: string | number;
    className?: string;
    isGlobalStyle?: boolean;
    isSentByUser?: boolean;
  };
}

export interface ConsoleSource {
  id: string;
  subject: BehaviorSubject<ConsoleLogValue>;
  resetSubject?: Subject<void>;
  style?: string;
}
export interface ConsoleSources {
  [key: ConsoleSourceKey | string]: ConsoleSource;
}

export type MultipleConsolePanelLogic = () => {
  showLogs: boolean;
  consoleTabs: ConsoleSourceKey[];
  consoleSources: ConsoleSources;
  activeTab?: ConsoleSourceKey;
  setActiveTab: React.Dispatch<
    React.SetStateAction<ConsoleSourceKey | undefined>
  >;
  selectedBoard?: Board;
  serialMonitorLogic: SerialMonitorLogic;
  isAppStarting: boolean;
  isAppStopping: boolean;
};

export interface ConsolePanelProps {
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
  isMaximized?: boolean;
  onMaximize?: () => void;
  onMinimize?: () => void;
}

export const CONSOLE_SOURCE_KEYS = {
  STARTUP: 'startup',
  SERIAL_MONITOR: 'serial-monitor',
  PYTHON: 'main',
} as const;

export type ConsoleSourceKey =
  | typeof CONSOLE_SOURCE_KEYS[keyof typeof CONSOLE_SOURCE_KEYS]
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {}); // to allow dynamic keys like brick IDs

export type AppendDataToSource = (
  appId: string,
  key: keyof ConsoleSources,
  data?: MessageData | ErrorData,
  createMissingKeys?: boolean,
  meta?: Partial<ConsoleLogValue['meta']>,
) => void;

export type AddConsoleSource = (
  appId: string,
  key: keyof ConsoleSources,
  options?: {
    initialValue?: string;
    initialMeta?: Partial<ConsoleLogValue['meta']>;
  },
) => void;

export type UseConsoleSources = () => {
  resetAllSources: (appId?: string) => void;
  consoleSources: Record<string, ConsoleSources>;
  consoleTabs: Record<string, ConsoleSourceKey[]>;
  activeConsoleTab: Record<string, ConsoleSourceKey | undefined>;
  setActiveConsoleTab: (
    appId: string,
    tab: ConsoleSourceKey | undefined,
  ) => void;
  addConsoleSource: AddConsoleSource;
  appendDataToSource: AppendDataToSource;
  setStyleToSource: (
    appId: string,
    tab: ConsoleSourceKey | undefined,
    style?: string,
  ) => void;
  reset: (appId: string, keysToRetain: string[]) => void;
};
