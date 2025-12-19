import { ArduinoUser } from '@bcmi-labs/art-auth';
import {
  ReactLocation,
  Router as LocationRouter,
} from '@tanstack/react-location';
import { HelmetProvider } from 'react-helmet-async';

import AuthContextProvider from './auth/AuthContextProvider';
import { CloudContextProviderRenderer } from './CloudContextProvider';
import QueryProvider from './data-fetching/QueryProvider';
import { I18nProvider } from './i18n/I18nContextProvider';
import ThemeProvider from './theme/ThemeProvider';

const location = new ReactLocation(); // needed as a "placeholder" for `react-location` logic nested in `AuthContextProvider`

interface ErrorProviderProps {
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
  children?: React.ReactNode;
}

const ErrorProvider: React.FC<ErrorProviderProps> = ({
  profile,
  profileIsLoading,
  children,
}: ErrorProviderProps) => {
  return (
    <LocationRouter location={location} routes={[]}>
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
    </LocationRouter>
  );
};

export default ErrorProvider;
