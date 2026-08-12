import { createContext, useContext } from 'react';

// Lets deep expandable blocks (Timeline rows, Thinking, tool calls) tell the thread to stop
// following its newest content when the reader expands one. The thread is held against its bottom
// edge by the browser, so without this the content an expand reveals is pushed straight back out
// of view — and while a turn streams, the tokens still arriving keep pushing. The default is a
// no-op, so the same components keep working when rendered outside the chat thread (no provider).
export interface AutoScrollControl {
  // Stop following the bottom edge (as if the reader had scrolled up), so what the expand
  // revealed stays where it is. Meant to be called on a user-driven expand.
  pauseAutoScroll: VoidFunction;
}

const AutoScrollContext = createContext<AutoScrollControl>({
  pauseAutoScroll: (): void => undefined,
});

export const AutoScrollProvider = AutoScrollContext.Provider;

// The thread's pause callback (a no-op when used outside a provider).
export const usePauseAutoScroll = (): VoidFunction =>
  useContext(AutoScrollContext).pauseAutoScroll;
