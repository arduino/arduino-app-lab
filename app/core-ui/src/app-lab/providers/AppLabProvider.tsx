import { ArduinoUser } from '@bcmi-labs/art-auth';
import { SnackbarProvider } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { HelmetProvider } from 'react-helmet-async';

import QueryProvider from '../../common/providers/data-fetching/QueryProvider';
import { I18nProvider } from '../../common/providers/i18n/I18nContextProvider';
import ThemeProvider from '../../common/providers/theme/ThemeProvider';
import BoardConfigurationContextProvider from './board-configuration/BoardConfigurationContextProvider';
import LinuxCredentialsContextProvider from './linux-credentials/LinuxCredentialsContextProvider';
import NetworkContextProvider from './network/NetworkContextProvider';
import RuntimeContextProvider from './runtime/runtimeContextProvider';
import SetupContextProvider from './setup/SetupContextProvider';

interface AppLabProviderProps {
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
  children?: React.ReactNode;
}

const AppLabProvider: React.FC<AppLabProviderProps> = (
  props: AppLabProviderProps,
) => {
  const { children } = props;

  return (
    <QueryProvider>
      <I18nProvider>
        <SetupContextProvider>
          <BoardConfigurationContextProvider>
            <NetworkContextProvider>
              <LinuxCredentialsContextProvider>
                <RuntimeContextProvider>
                  <ThemeProvider>
                    <SnackbarProvider />
                    <HelmetProvider>{children}</HelmetProvider>
                  </ThemeProvider>
                </RuntimeContextProvider>
              </LinuxCredentialsContextProvider>
            </NetworkContextProvider>
          </BoardConfigurationContextProvider>
        </SetupContextProvider>
      </I18nProvider>
    </QueryProvider>
  );
};

export default AppLabProvider;
