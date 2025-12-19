import { UseNetworkLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext } from 'react';

export type NetworkContextValue = ReturnType<UseNetworkLogic>;

const NetworkContextValue: NetworkContextValue = {} as NetworkContextValue;

export const NetworkContext =
  createContext<NetworkContextValue>(NetworkContextValue);
