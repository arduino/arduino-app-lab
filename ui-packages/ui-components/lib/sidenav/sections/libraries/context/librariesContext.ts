import { createContext } from 'react';

import { UseLibrariesLogic } from '../../../sidenav.type';

export type LibrariesContextValue = ReturnType<UseLibrariesLogic>;

const librariesContextValue: LibrariesContextValue =
  {} as LibrariesContextValue;

export const LibrariesContext = createContext<LibrariesContextValue>(
  librariesContextValue,
);
