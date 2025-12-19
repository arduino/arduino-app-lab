import { createContext } from 'react';

import { UseSettingsLogic } from '../../../sidenav.type';

export type SettingsContextValue = ReturnType<UseSettingsLogic>;

const settingsContextValue: SettingsContextValue = {} as SettingsContextValue;

export const SettingsContext =
  createContext<SettingsContextValue>(settingsContextValue);
