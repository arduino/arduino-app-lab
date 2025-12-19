import { ArduinoUser } from '@bcmi-labs/art-auth';
import { HelmetProvider } from 'react-helmet-async';

import AuthContextProvider from './auth/AuthContextProvider';
import { CloudContextProviderRenderer } from './CloudContextProvider';
import QueryProvider from './data-fetching/QueryProvider';
import { I18nProvider } from './i18n/I18nContextProvider';
import ThemeProvider from './theme/ThemeProvider';

interface OfflineFoundProviderProps {
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
  children?: React.ReactNode;
}

const OfflineFoundProvider: React.FC<OfflineFoundProviderProps> = ({
  profile,
  profileIsLoading,
  children,
}: OfflineFoundProviderProps) => {
  return (
    <QueryProvider>
      <I18nProvider>
        <AuthContextProvider
          profile={profile}
          profileIsLoading={profileIsLoading}
        >
          <CloudContextProviderRenderer>
            <ThemeProvider>
              <HelmetProvider>{children}</HelmetProvider>
            </ThemeProvider>
          </CloudContextProviderRenderer>
        </AuthContextProvider>
      </I18nProvider>
    </QueryProvider>
  );
};

export default OfflineFoundProvider;
