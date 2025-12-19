import { ErrorData, MessageData } from '@cloud-editor-mono/infrastructure';
import { BehaviorSubject, Subject } from 'rxjs';

import { Board } from '../app-lab-setup';

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
  // key is startup, serial-monitor, main, ...bricksID
  [key: string]: ConsoleSource;
}

export type MultipleConsolePanelLogic = () => {
  showLogs: boolean;
  consoleTabs: string[];
  consoleSources: ConsoleSources;
  activeTab?: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string | undefined>>;
  resetSource: Subject<void>;
  onMessageSend: (message: string) => void;
  selectedBoard?: Board;
};

export interface ConsolePanelProps {
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
}

export const AL_STARTUP_KEY = 'startup';
export const AL_STOP_KEY = 'stop';
export const AL_SERIAL_MONITOR_KEY = 'serial-monitor';
export const AL_PYTHON_KEY = 'main';

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
  consoleTabs: string[];
  activeConsoleTab?: string;
  setActiveConsoleTab: React.Dispatch<React.SetStateAction<string | undefined>>;
  addConsoleSource: AddConsoleSource;
  appendDataToSource: AppendDataToSource;
  reset: (keysToRetain: string[]) => void;
};
