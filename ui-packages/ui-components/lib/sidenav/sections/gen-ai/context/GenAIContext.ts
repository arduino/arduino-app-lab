import { createContext } from 'react';

import { UseGenAILogic } from '../../../sidenav.type';

type GenAIContextValue = ReturnType<UseGenAILogic>;

const genAIContextValue: GenAIContextValue = {} as GenAIContextValue;

export const GenAIContext: React.Context<GenAIContextValue> =
  createContext<GenAIContextValue>(genAIContextValue);
