import {
  AL_PYTHON_KEY,
  AL_SERIAL_MONITOR_KEY,
  AL_STARTUP_KEY,
} from './multipleConsolePanel.type';

export const getOrderedConsoleTabs = (tabs: string[]): string[] => {
  const preferredOrder = [AL_STARTUP_KEY, AL_SERIAL_MONITOR_KEY, AL_PYTHON_KEY];

  return tabs.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return 0;
  });
};
