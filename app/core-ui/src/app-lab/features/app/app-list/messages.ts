import { AppsSection } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { defineMessages } from 'react-intl';

export type EmptyStateKey = AppsSection | 'inspirations';

export const emptyTitleMessages = defineMessages<EmptyStateKey>({
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
  inspirations: {
    id: 'appList.emptyInspirations',
    defaultMessage: 'No inspirations found',
    description: 'No inspirations found',
  },
});

export const emptyDescriptionMessages = defineMessages<EmptyStateKey>({
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
  inspirations: {
    id: 'appList.emptyInspirationsDescription',
    defaultMessage:
      'There might be an issue with retrieving inspirations from the board',
    description: 'No inspirations found description',
  },
});

export const emptySearchMessages = defineMessages({
  examples: {
    id: 'appList.emptySearchExamples',
    defaultMessage: 'Please check your spelling or try other keywords.',
    description: 'No examples match the search query',
  },
});

export const appListMessages = defineMessages({
  actionCreate: {
    id: 'appList.actionCreate',
    defaultMessage: 'Create new app',
    description: 'Create a new app',
  },
  successfullyDeletedApp: {
    id: 'app-lab.app-list.successfully-deleted-app',
    defaultMessage: 'App successfully deleted',
    description: 'Success message when an app is deleted',
  },
  successfullyRenamedApp: {
    id: 'app-lab.app-list.successfully-renamed-app',
    defaultMessage: 'App successfully renamed',
    description: 'Success message when an app is renamed',
  },
  successfullyExportedApp: {
    id: 'app-lab.app-list.successfully-exported-app',
    defaultMessage: '{appName} successfully exported',
    description: 'Success message when an app is exported',
  },
  setAsDefault: {
    id: 'app-lab.app-list.set-as-default',
    defaultMessage: '{appName} set as default app',
    description: 'Success message when an app is set as default',
  },
  removedAsDefault: {
    id: 'app-lab.app-list.removed-as-default',
    defaultMessage: '{appName} removed as default app',
    description: 'Success message when an app is removed as default',
  },
  searchExamples: {
    id: 'app-lab.app-list.search-examples',
    defaultMessage: 'Search',
    description: 'Search examples placeholder',
  },
});
