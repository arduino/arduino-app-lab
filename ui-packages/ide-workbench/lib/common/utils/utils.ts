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
  return parser.getOS().name === 'Mac OS' ? '⌘' : 'Ctrl+';
};

// ---------------------------------------------------------------------------
// Vendored from @cloud-editor-mono/common (ADR-0002, 4b): a published package
// cannot depend on a private workspace for seven one-liners. Kept byte-identical
// so behaviour is unchanged; if `common` is ever published these can go back to
// being imports.

export function getCSSVariable(variable: string): string {
  return document.documentElement.style.getPropertyValue(variable);
}

export function setCSSVariable(variable: string, value: string): void {
  document.documentElement.style.setProperty(variable, value);
}

export const objectEntries = <T extends object>(
  obj: T,
): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};

export const objectKeys = <T extends object>(obj: T): (keyof T)[] => {
  return Object.keys(obj) as (keyof T)[];
};

export function trimFileExtension(input: string): string {
  return input.replace(/\.[^.]+$/, '');
}

export const EmptyFn = (): void => undefined;

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
