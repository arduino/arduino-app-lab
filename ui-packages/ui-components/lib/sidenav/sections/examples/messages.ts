import { defineMessages } from 'react-intl';

import { ExamplesMenuItemIds, SidenavExamplesIds } from '../../sidenav.type';

export const sidenavExamplesMessages = defineMessages<
  keyof typeof SidenavExamplesIds
>({
  [SidenavExamplesIds.Device]: {
    id: 'sidenavExamples.device',
    defaultMessage: 'Device',
    description: 'Device',
  },
  [SidenavExamplesIds.BuiltIn]: {
    id: 'sidenavExamples.builtIn',
    defaultMessage: 'Built-in',
    description: 'Built-in',
  },
  [SidenavExamplesIds.FromLibraries]: {
    id: 'sidenavExamples.fromLibraries',
    defaultMessage: 'From Libraries',
    description: 'From Libraries',
  },
});

export const examplesMenuMessages = defineMessages<
  keyof typeof ExamplesMenuItemIds
>({
  [ExamplesMenuItemIds.CopyInYourSketches]: {
    id: 'examplesMenu.copyInYourSketches',
    defaultMessage: 'Copy in your sketches',
    description: 'Copy in your sketches',
  },
  [ExamplesMenuItemIds.Download]: {
    id: 'examplesMenu.download',
    defaultMessage: 'Download',
    description: 'Download',
  },
});

export const examplesMessages = defineMessages({
  searchExamples: {
    id: 'examples.searchExamples',
    defaultMessage: 'Search examples',
    description: 'Search examples',
  },
  allDevices: {
    id: 'examples.allDevices',
    defaultMessage: 'ALL DEVICES',
    description: 'Filter examples by device',
  },
  showExamples: {
    id: 'examples.showExamples',
    defaultMessage: 'Showing examples for: ',
    description: 'Filter examples by device message',
  },
});
