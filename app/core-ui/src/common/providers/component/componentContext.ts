import { ArduinoUser } from '@bcmi-labs/art-auth';
import { EmptyFn } from '@cloud-editor-mono/common';
import React, { createContext } from 'react';

import { ComponentUpdateLogic } from './ComponentContextProvider';

export type ComponentContextValue = {
  headerless?: boolean;
  isIotComponent?: boolean;
  sketchId?: string;
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
  notificationElement: React.ReactNode;
  preVerify?: () => Promise<boolean>;
  updateLogic: ComponentUpdateLogic;
};

const componentContextValue: ComponentContextValue = {
  headerless: false,
  notificationElement: null,
  updateLogic: EmptyFn,
};

export const ComponentContext = createContext<ComponentContextValue>(
  componentContextValue,
);
