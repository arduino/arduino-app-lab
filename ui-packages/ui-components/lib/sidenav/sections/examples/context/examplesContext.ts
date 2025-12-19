import { createContext } from 'react';

import { UseExamplesLogic } from '../../../sidenav.type';

export type ExamplesContextValue = ReturnType<UseExamplesLogic>;

const examplesContextValue: ExamplesContextValue = {} as ExamplesContextValue;

export const ExamplesContext =
  createContext<ExamplesContextValue>(examplesContextValue);
