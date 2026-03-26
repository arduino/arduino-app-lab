import { createContext } from 'react';

import { UseUpdater } from './updaterContextProvider.logic';

export type UpdaterContextValue = ReturnType<UseUpdater>;

const UpdaterContextValue: UpdaterContextValue = {} as UpdaterContextValue;

export const UpdaterContext =
  createContext<UpdaterContextValue>(UpdaterContextValue);
