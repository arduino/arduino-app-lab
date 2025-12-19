import { ArduinoUser, GetTokenSilentlyOptions } from '@bcmi-labs/art-auth';
import { EmptyFn, setGlobalConfig } from '@cloud-editor-mono/common';
import {
  getExternalAccessToken,
  injectedUser,
  setGetAccessToken,
  setInjectedUser,
} from '@cloud-editor-mono/domain';
import { useEffect } from 'react';

import { ComponentContext } from './componentContext';
import { useComponent } from './componentContextProvider.logic';

export type ComponentAppEnv = 'development' | 'test' | 'production';

export interface ComponentEnvironment {
  APP_ENV: ComponentAppEnv;
  APP_ORIGIN: string;
  NEW_WINDOW_ORIGIN: string;
  ROUTING_BASE_URL: string;
  CLOUD_HOME_URL: string;
  API_URL: string;
  WL_API_URL: string;
  CREATE_API_URL: string;
  BUILDER_API_URL: string;
  BUILDER_API_V2_URL: string;
  IOT_API_URL: string;
  OTA_API_URL: string;
  USERS_API_URL: string;
  GEN_AI_API_URL: string;
  RESTRICTIONS_API_URL: string;
  CODE_FORMATTER_API_URL: string;
}

export enum ComponentUpdateEvent {
  SketchChange = 'sketch-change',
  AssociatedDeviceChange = 'associated-device-change',
  FileListChange = 'file-list-change',
  FilesContentChange = 'files-content-change',
}

export type ComponentUpdateEventPayload =
  | {
      type: ComponentUpdateEvent.SketchChange;
      data?: never;
    }
  | {
      type: ComponentUpdateEvent.AssociatedDeviceChange;
      data?: never;
    }
  | {
      type: ComponentUpdateEvent.FileListChange;
      data?: never;
    }
  | {
      type: ComponentUpdateEvent.FilesContentChange;
      data: { filePaths: string[] };
    };

export type ComponentUpdateLogic = (
  emitUpdate: (payload: ComponentUpdateEventPayload) => void,
) => void;

export interface ComponentProps {
  sketchId: string;
  profile?: ArduinoUser;
  env: ComponentEnvironment;
  notificationElement?: React.ReactNode;
  getAccessToken: (options?: GetTokenSilentlyOptions) => Promise<string>;
  preVerify?: () => Promise<boolean>;
  updateLogic?: ComponentUpdateLogic;
}

type ComponentContextProviderProps = ComponentProps & {
  headerless?: boolean;
  profileIsLoading?: boolean;
  isIotComponent: boolean;
  children: React.ReactNode | undefined;
};

let setEnv = true;

const ComponentContextProvider: React.FC<ComponentContextProviderProps> = ({
  headerless,
  isIotComponent,
  sketchId,
  profile,
  profileIsLoading,
  env,
  notificationElement,
  preVerify,
  getAccessToken,
  updateLogic = EmptyFn,
  children,
}: ComponentContextProviderProps) => {
  if (setEnv) {
    setEnv = false;
    const { APP_ENV, NEW_WINDOW_ORIGIN, ...rest } = env;
    setGlobalConfig({
      ...rest,
      MODE: APP_ENV,
      APP_URL: `${env.APP_ORIGIN}/${env.ROUTING_BASE_URL}`,
      NEW_WINDOW_ORIGIN: NEW_WINDOW_ORIGIN ?? env.APP_ORIGIN,
    });
  }

  useEffect(() => {
    if (getAccessToken && !getExternalAccessToken) {
      setGetAccessToken(getAccessToken);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (profile && !injectedUser) {
      setInjectedUser(profile);
    }

    return () => {
      setInjectedUser(null);
    };
  }, [profile]);

  useComponent(sketchId, profileIsLoading);

  return (
    <ComponentContext.Provider
      value={{
        headerless,
        isIotComponent,
        sketchId,
        profile,
        profileIsLoading,
        updateLogic,
        notificationElement,
        preVerify,
      }}
    >
      {children}
    </ComponentContext.Provider>
  );
};

export default ComponentContextProvider;
