import { defineMessages } from 'react-intl';

export const appItemMessages = defineMessages({
  appDefault: {
    id: 'appItem.appDefault',
    defaultMessage: 'Default',
    description: 'Indicates that the app is the default one',
  },
  appRunning: {
    id: 'appItem.appRunning',
    defaultMessage: 'Running',
    description: 'Indicates that the app is currently running',
  },
  appSize: {
    id: 'appItem.appSize',
    defaultMessage: 'Size: {size} MB',
    description: 'Indicates the size of the app',
  },
});
