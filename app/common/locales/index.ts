export interface Language {
  name: string;
}

export const Locales = {
  ENGLISH: 'en-us',
} as const;

export type LocaleType = typeof Locales[keyof typeof Locales];

export const LANGUAGES: Record<LocaleType, Language> = {
  [Locales.ENGLISH]: {
    name: 'English',
  },
} as const;
