import { defineMessages } from 'react-intl';

import { AppsSection } from '../../routes/__root';

export type AppListSections = Extract<AppsSection, 'my-apps' | 'examples'>;

export const emptyTitleMessages = defineMessages<AppListSections>({
  'my-apps': {
    id: 'appList.emptyMyApps',
    defaultMessage: 'No apps yet',
    description: 'No apps yet',
  },
  examples: {
    id: 'appList.emptyExamples',
    defaultMessage: 'No examples found',
    description: 'No examples found',
  },
});

export const emptyDescriptionMessages = defineMessages<AppListSections>({
  'my-apps': {
    id: 'appList.emptyMyAppsDescription',
    defaultMessage:
      'Get started by creating a new one from scratch or using an example',
    description: 'No apps yet description',
  },
  examples: {
    id: 'appList.emptyExamplesDescription',
    defaultMessage:
      'There might be an issue with retrieving examples from the board',
    description: 'No examples found description',
  },
});

export const appListMessages = defineMessages({
  actionCreate: {
    id: 'appList.actionCreate',
    defaultMessage: 'Create new app',
    description: 'Create a new app',
  },
});
