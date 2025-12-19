/* create a react context for i18n to select the language */

import { LocaleType } from '@cloud-editor-mono/common';
import { createContext } from 'react';

export type I18nContextValue = {
  currentLocale: LocaleType;
  setCurrentLocale: (locale: LocaleType) => void;
};

const i18nContextValue: I18nContextValue = {} as I18nContextValue;

export const I18nContext = createContext<I18nContextValue>(i18nContextValue);
