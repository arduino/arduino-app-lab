import { Preferences } from '@cloud-editor-mono/ui-components/lib/sidenav/sections/settings/settings.type';
import { Themes } from '@cloud-editor-mono/ui-components/themes/theme.type';
import clsx from 'clsx';
import { useState } from 'react';
import { useMedia } from 'react-use';

import { usePreferenceObservable } from '../../hooks/preferences';
import styles from './theme-provider.module.scss';
import { ThemeContext } from './themeContext';

interface ThemeProviderProps {
  children?: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = (
  props: ThemeProviderProps,
) => {
  const { children } = props;

  const isDarkModeOs = useMedia('(prefers-color-scheme:dark)');

  const preferredTheme = usePreferenceObservable(Preferences.Theme);
  const isAutoTheme = usePreferenceObservable(Preferences.AutoTheme);

  const initialTheme = isAutoTheme
    ? isDarkModeOs
      ? Themes.DarkTheme
      : Themes.LightTheme
    : preferredTheme ?? Themes.LightTheme;

  const [theme, setTheme] = useState(String(initialTheme));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkModeOs }}>
      <div className={clsx(theme, styles.themeContainer)}>{children}</div>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
