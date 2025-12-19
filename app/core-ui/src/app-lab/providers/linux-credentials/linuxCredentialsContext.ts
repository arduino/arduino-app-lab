import { UseLinuxCredentialsLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext } from 'react';

export type LinuxCredentialsContextValue = ReturnType<UseLinuxCredentialsLogic>;

const LinuxCredentialsContextValue: LinuxCredentialsContextValue =
  {} as LinuxCredentialsContextValue;

export const LinuxCredentialsContext =
  createContext<LinuxCredentialsContextValue>(LinuxCredentialsContextValue);
