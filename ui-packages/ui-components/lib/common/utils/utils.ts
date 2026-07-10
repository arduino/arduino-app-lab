import { UAParser } from 'ua-parser-js';

export function iterable<T>(cursor: Iterator<T>): Iterable<T> {
  return {
    [Symbol.iterator]: () => cursor,
  };
}

export const createMatchCounterWorker = (
  isEnabled: boolean = true,
): undefined | Worker => {
  return isEnabled
    ? new Worker(new URL('../workers/matchCounter.ts', import.meta.url), {
        type: 'module',
      })
    : undefined;
};

export const getShortcutCommand = (): string => {
  const parser = new UAParser();
  return parser.getOS().name === 'Mac OS' ? '⌘' : 'Ctrl + ';
};
