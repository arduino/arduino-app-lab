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
  };
}

export interface ConsoleSource {
  id: string;
  subject: BehaviorSubject<ConsoleLogValue>;
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
  resetSource: Subject<void>;
  selectedBoard?: Board;
  serialMonitorLogic: SerialMonitorLogic;
  isAppStarting: boolean;
};

export interface ConsolePanelProps {
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
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
  key: keyof ConsoleSources,
  data?: MessageData | ErrorData,
  createMissingKeys?: boolean,
  meta?: Partial<ConsoleLogValue['meta']>,
) => void;

export type AddConsoleSource = (
  key: keyof ConsoleSources,
  options?: {
    sourcesOwnerAppId?: string;
    initialValue?: string;
    initialMeta?: Partial<ConsoleLogValue['meta']>;
  },
) => void;

export type UseConsoleSources = () => {
  consoleSourcesOwner?: string;
  consoleSources: ConsoleSources;
  consoleSourcesResetSubject: Subject<void>;
  consoleTabs: ConsoleSourceKey[];
  activeConsoleTab?: ConsoleSourceKey;
  setActiveConsoleTab: React.Dispatch<
    React.SetStateAction<ConsoleSourceKey | undefined>
  >;
  addConsoleSource: AddConsoleSource;
  appendDataToSource: AppendDataToSource;
  reset: (keysToRetain: string[]) => void;
};
