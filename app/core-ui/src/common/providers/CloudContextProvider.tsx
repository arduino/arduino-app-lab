import { useAuth as useArtAuth } from '@bcmi-labs/art-auth';
import { CloudContextProvider, SidebarSpace } from '@bcmi-labs/cloud-sidebar';
import { Config } from '@cloud-editor-mono/common';
import {
  getSpaceStorageInstance,
  isPlayStoreApp,
} from '@cloud-editor-mono/domain';
import React, { useContext } from 'react';

import { AuthContext } from './auth/authContext';

const { API_URL, ID_URL, DIGITAL_STORE_URL, CLOUD_CDN_URL: ICON_CDN } = Config;

export const CloudContextProviderRenderer: React.FC<
  React.PropsWithChildren
> = ({ children }: React.PropsWithChildren) => {
  const { isAuthInjected } = useContext(AuthContext);

  if (isAuthInjected) {
    return <>{children}</>;
  }

  return <CloudContextProviderWrapper>{children}</CloudContextProviderWrapper>;
};

interface CloudContextProviderWrapperProps {
  children?: React.ReactNode;
}

const CloudContextProviderWrapper: React.FC<
  CloudContextProviderWrapperProps
> = ({ children }: CloudContextProviderWrapperProps) => {
  const { client } = useArtAuth();
  return (
    <CloudContextProvider
      api={{
        baseurl: API_URL,
      }}
      onSpaceChange={createOnSpaceChange(
        client.getCustomization()?.url || Config.CLOUD_HOME_URL,
      )}
      env={{
        DIGITAL_STORE_URL: isPlayStoreApp() ? '' : DIGITAL_STORE_URL,
        ID_URL,
        ICON_CDN,
        CLOUD_HOME_URL: client.getCustomization()?.url || Config.CLOUD_HOME_URL,
      }}
      storage={getSpaceStorageInstance()}
    >
      {children}
    </CloudContextProvider>
  );
};

const createOnSpaceChange =
  (url: string) =>
  (_: SidebarSpace): void => {
    window.location.href = `${url}/sketches`;
  };
