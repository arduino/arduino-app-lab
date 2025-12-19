import { ArduinoUser } from '@bcmi-labs/art-auth';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';

import AuthContextProvider from './auth/AuthContextProvider';
import { CloudContextProviderRenderer } from './CloudContextProvider';
import QueryProvider from './data-fetching/QueryProvider';
import DialogProvider from './dialog/dialogProvider';
import { I18nProvider } from './i18n/I18nContextProvider';
import NotificationsProvider from './notifications/notificationsProvider';
import SerialCommunicationContextProvider from './serial-communication/SerialCommunicationContextProvider';
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
}: MainProviderProps) => (
  <QueryProvider>
    <I18nProvider>
      <SerialCommunicationContextProvider>
        <AuthContextProvider
          profile={profile}
          profileIsLoading={profileIsLoading}
        >
          <CloudContextProviderRenderer>
            <ThemeProvider>
              <NotificationsProvider>
                <DialogProvider>
                  <HelmetProvider>{children}</HelmetProvider>
                </DialogProvider>
              </NotificationsProvider>
            </ThemeProvider>
          </CloudContextProviderRenderer>
        </AuthContextProvider>
      </SerialCommunicationContextProvider>
    </I18nProvider>
  </QueryProvider>
);

export default MainProvider;
