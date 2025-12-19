import { Locales, LocaleType } from '@cloud-editor-mono/common';
import { useState } from 'react';
import { IntlProvider } from 'react-intl';

import { I18nContext } from './i18nContext';

interface I18nProviderProps {
  children?: React.ReactNode;
}

const DEFAULT_LOCALE = Locales.ENGLISH;

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
}: I18nProviderProps) => {
  const [currentLocale, setCurrentLocale] =
    useState<LocaleType>(DEFAULT_LOCALE);

  return (
    <I18nContext.Provider value={{ currentLocale, setCurrentLocale }}>
      <IntlProvider locale={currentLocale} defaultLocale={DEFAULT_LOCALE}>
        {children}
      </IntlProvider>
    </I18nContext.Provider>
  );
};
