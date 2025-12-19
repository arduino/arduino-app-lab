import { ArduinoUser } from '@bcmi-labs/art-auth';

import AuthContextProvider from './auth/AuthContextProvider';
import QueryProvider from './data-fetching/QueryProvider';
import { I18nProvider } from './i18n/I18nContextProvider';
import ThemeProvider from './theme/ThemeProvider';

interface MainProviderProps {
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
  children?: React.ReactNode;
}

const MainProvider: React.FC<MainProviderProps> = ({
  profile,
  profileIsLoading,
  children,
}: MainProviderProps) => {
  return (
    <QueryProvider>
      <AuthContextProvider
        profile={profile}
        profileIsLoading={profileIsLoading}
      >
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </AuthContextProvider>
    </QueryProvider>
  );
};

export default MainProvider;
