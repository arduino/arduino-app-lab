import { SnackbarProvider } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HelmetProvider } from 'react-helmet-async';

import QueryProvider from '../../common/providers/data-fetching/QueryProvider';
import { I18nProvider } from '../../common/providers/i18n/I18nContextProvider';
import ThemeProvider from '../../common/providers/theme/ThemeProvider';
import AiModelsContextProvider from './ai-models/AiModelsContextProvider';
import AuthContextProvider from './auth/AuthContextProvider';
import BoardConfigurationContextProvider from './board-configuration/BoardConfigurationContextProvider';
import BoardResourcesContextProvider from './board-resources/BoardResourcesContextProvider';
import EdgeImpulseContextProvider from './edge-impulse/EdgeImpulseContextProvider';
import FooterNotificationsContextProvider from './footer-notifications/FooterNotificationsContextProvider';
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
    <DndProvider backend={HTML5Backend}>
      <QueryProvider>
        <I18nProvider>
          <FooterNotificationsContextProvider>
            <BoardResourcesContextProvider>
              <EdgeImpulseContextProvider>
                <AuthContextProvider>
                  <SetupContextProvider>
                    <BoardConfigurationContextProvider>
                      <NetworkContextProvider>
                        <LinuxCredentialsContextProvider>
                          <AiModelsContextProvider>
                            <RuntimeContextProvider>
                              <UpdaterContextProvider>
                                <ThemeProvider>
                                  <SnackbarProvider />
                                  <HelmetProvider>{children}</HelmetProvider>
                                </ThemeProvider>
                              </UpdaterContextProvider>
                            </RuntimeContextProvider>
                          </AiModelsContextProvider>
                        </LinuxCredentialsContextProvider>
                      </NetworkContextProvider>
                    </BoardConfigurationContextProvider>
                  </SetupContextProvider>
                </AuthContextProvider>
              </EdgeImpulseContextProvider>
            </BoardResourcesContextProvider>
          </FooterNotificationsContextProvider>
        </I18nProvider>
      </QueryProvider>
    </DndProvider>
  );
};

export default AppLabProvider;
