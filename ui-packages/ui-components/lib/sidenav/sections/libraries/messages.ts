import { defineMessages } from 'react-intl';

import { SidenavLibrariesIds } from '../../sidenav.type';

export const sidenavLibrariesMessages = defineMessages<
  keyof typeof SidenavLibrariesIds
>({
  [SidenavLibrariesIds.Standard]: {
    id: 'sidenavLibraries.standard',
    defaultMessage: 'All Libraries',
    description: 'All Libraries',
  },
  [SidenavLibrariesIds.Custom]: {
    id: 'sidenavLibraries.custom',
    defaultMessage: 'Custom',
    description: 'Custom',
  },
  [SidenavLibrariesIds.Favorites]: {
    id: 'sidenavLibraries.favorites',
    defaultMessage: 'Favorites',
    description: 'Favorites',
  },
});

export const libraryItemMessages = defineMessages({
  latestVersionPrefix: {
    id: 'sidenavLibraries.latest',
    defaultMessage: 'Latest',
    description: 'prefix of latest version',
  },
  includedVersionPrefix: {
    id: 'sidenavLibraries.included',
    defaultMessage: 'Included version',
    description: 'prefix of included version',
  },
  includeDisabledTitle: {
    id: 'sidenavLibraries.includeDisabledTitle',
    defaultMessage: 'Inclusion must be done manually',
    description: 'title of include disabled button tooltip',
  },
  includeDisabledContent: {
    id: 'sidenavLibraries.includeDisabledContent',
    defaultMessage:
      'Add an "includes" field to the library.properties file to enable this.',
    description: 'content of include disabled button tooltip',
  },
});
