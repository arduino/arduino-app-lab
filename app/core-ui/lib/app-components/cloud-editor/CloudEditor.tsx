import { useEffect } from 'react';

import { Router as RoutedApp, RouterProps } from '../../../src/routing/Router';
import { resetModuleScopedState } from './utils';

export type AppProps = RouterProps;
export {
  createRoutes,
  defaultLocationConfig,
} from '../../../src/routing/Router';

const App: React.FC<AppProps> = ({
  location,
  routes,
  renderOutletContextProvider,
}: AppProps) => {
  useEffect(() => {
    return () => resetModuleScopedState();
  }, []);

  return (
    <RoutedApp
      location={location}
      routes={routes}
      renderOutletContextProvider={renderOutletContextProvider}
    />
  );
};

export {
  type ComponentAppEnv,
  type ComponentEnvironment,
  type ComponentUpdateEventPayload,
  type ComponentUpdateLogic,
  default as ComponentContextProvider,
  ComponentUpdateEvent,
} from '../../../src/common/providers/component/ComponentContextProvider';

export default App;
