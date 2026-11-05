// Kept whole: an error Go sends with a code is JSON, which describeError words where it is shown.
export const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);
