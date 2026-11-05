declare global {
  interface Array<T> {
    findLastIndex(
      predicate: (value: T, index: number, obj: T[]) => unknown,
      thisArg?: unknown,
    ): number;

    findLast(
      predicate: (value: T, index: number, array: T[]) => unknown,
      thisArg?: unknown,
    ): T | undefined;
  }
}
