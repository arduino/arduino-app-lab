import {
  CONSOLE_SOURCE_KEYS,
  ConsoleSourceKey,
} from './multipleConsolePanel.type';

const PRIORITY: Record<ConsoleSourceKey, number> = {
  [CONSOLE_SOURCE_KEYS.STARTUP]: 0,
  [CONSOLE_SOURCE_KEYS.SERIAL_MONITOR]: 1,
  [CONSOLE_SOURCE_KEYS.PYTHON]: 2,
};

const NO_PRIORITY = Number.MAX_SAFE_INTEGER;

export const getOrderedConsoleTabs = (
  tabs: ConsoleSourceKey[],
): ConsoleSourceKey[] => {
  return [...tabs].sort((a, b) => {
    const priorityA = PRIORITY[a] ?? NO_PRIORITY;
    const priorityB = PRIORITY[b] ?? NO_PRIORITY;

    return priorityA - priorityB;
  });
};
