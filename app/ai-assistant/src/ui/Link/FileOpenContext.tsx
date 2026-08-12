import { createContext, useContext } from 'react';

// How a file link in agent output is opened. The chat panel provides it, so a path the host refuses
// ("not part of an app the agent opened") surfaces in the composer banner instead of being swallowed
// — the reason ui/ never calls the service itself. Undefined outside a provider: nothing can open a
// file there, so Link renders the path as plain text rather than as a link that does nothing.
const FileOpenContext = createContext<((path: string) => void) | undefined>(
  undefined,
);

export const FileOpenProvider = FileOpenContext.Provider;

export const useFileOpen = (): ((path: string) => void) | undefined =>
  useContext(FileOpenContext);
