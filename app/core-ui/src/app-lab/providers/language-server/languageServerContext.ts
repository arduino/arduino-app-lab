import { createContext } from 'react';

import { UseLanguageServer } from './languageServerContextProvider.logic';

export type LanguageServerContextValue = ReturnType<UseLanguageServer>;

const LanguageServerContextValue: LanguageServerContextValue =
  {} as LanguageServerContextValue;

export const LanguageServerContext = createContext<LanguageServerContextValue>(
  LanguageServerContextValue,
);
