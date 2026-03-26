import { SnackbarProvider } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { HelmetProvider } from 'react-helmet-async';

import QueryProvider from '../../common/providers/data-fetching/QueryProvider';
import { I18nProvider } from '../../common/providers/i18n/I18nContextProvider';
import ThemeProvider from '../../common/providers/theme/ThemeProvider';
import AuthContextProvider from './auth/AuthContextProvider';
import BoardConfigurationContextProvider from './board-configuration/BoardConfigurationContextProvider';
import BoardResourcesContextProvider from './board-resources/BoardResourcesContextProvider';
import EdgeImpulseContextProvider from './edge-impulse/EdgeImpulseContextProvider';
import EdgeImpulseModelsContextProvider from './edge-impulse-models/EdgeImpulseModelsContextProvider';
import LinuxCredentialsContextProvider from './linux-credentials/LinuxCredentialsContextProvider';
import NetworkContextProvider from './network/NetworkContextProvider';
import RuntimeContextProvider from './runtime/runtimeContextProvider';
import SetupContextProvider from './setup/SetupContextProvider';
import UpdaterContextProvider from './updater/UpdaterContextProvider';

interface AppLabProviderProps {
  children?: React.ReactNode;
}

const AppLabProvider: React.FC<AppLabProviderProps> = (
  props: AppLabProviderProps,
) => {
  const { children } = props;

  return (
    <QueryProvider>
      <I18nProvider>
        <BoardResourcesContextProvider>
          <EdgeImpulseContextProvider>
            <AuthContextProvider>
              <SetupContextProvider>
                <BoardConfigurationContextProvider>
                  <NetworkContextProvider>
                    <LinuxCredentialsContextProvider>
                      <EdgeImpulseModelsContextProvider>
                        <RuntimeContextProvider>
                          <UpdaterContextProvider>
                            <ThemeProvider>
                              <SnackbarProvider />
                              <HelmetProvider>{children}</HelmetProvider>
                            </ThemeProvider>
                          </UpdaterContextProvider>
                        </RuntimeContextProvider>
                      </EdgeImpulseModelsContextProvider>
                    </LinuxCredentialsContextProvider>
                  </NetworkContextProvider>
                </BoardConfigurationContextProvider>
              </SetupContextProvider>
            </AuthContextProvider>
          </EdgeImpulseContextProvider>
        </BoardResourcesContextProvider>
      </I18nProvider>
    </QueryProvider>
  );
};

export default AppLabProvider;
