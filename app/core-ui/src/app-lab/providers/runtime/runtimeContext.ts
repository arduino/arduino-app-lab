import { UseRuntimeLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext } from 'react';

export type RuntimeContextValue = ReturnType<UseRuntimeLogic>;

const RuntimeContextValue: RuntimeContextValue = {} as RuntimeContextValue;

export const RuntimeContext =
  createContext<RuntimeContextValue>(RuntimeContextValue);
