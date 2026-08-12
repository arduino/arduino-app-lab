import { createContext } from 'react';

import { UseCloudConnector } from './cloudConnectorContextProvider.logic';

export type CloudConnectorContextValue = Omit<
  ReturnType<UseCloudConnector>,
  'errorDialogLogic' | 'requiredDialogLogic'
>;

const CloudConnectorContextValue: CloudConnectorContextValue =
  {} as CloudConnectorContextValue;

export const CloudConnectorContext = createContext<CloudConnectorContextValue>(
  CloudConnectorContextValue,
);
