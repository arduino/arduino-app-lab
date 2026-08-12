import {
  CloudConnectorErrorDialog,
  CloudConnectorRequiredDialog,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { CloudConnectorContext } from './cloudConnectorContext';
import { useCloudConnector } from './cloudConnectorContextProvider.logic';

interface CloudConnectorContextProviderProps {
  children?: React.ReactNode;
}

const CloudConnectorContextProvider: React.FC<
  CloudConnectorContextProviderProps
> = (props: CloudConnectorContextProviderProps) => {
  const { children } = props;
  const { errorDialogLogic, requiredDialogLogic, ...contextValue } =
    useCloudConnector();

  return (
    <CloudConnectorContext.Provider value={contextValue}>
      <CloudConnectorErrorDialog logic={errorDialogLogic} />
      <CloudConnectorRequiredDialog logic={requiredDialogLogic} />
      {children}
    </CloudConnectorContext.Provider>
  );
};

export default CloudConnectorContextProvider;
