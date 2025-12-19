import { createContext } from 'react';

interface ThemeContextValue {
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  isDarkModeOs: boolean;
}

const ThemeContextValue: ThemeContextValue = {} as ThemeContextValue;

export const ThemeContext = createContext<ThemeContextValue>(ThemeContextValue);
