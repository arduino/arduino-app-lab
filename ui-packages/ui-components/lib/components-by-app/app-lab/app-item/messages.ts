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
  actionRename: {
    id: 'appItem.actionRename',
    defaultMessage: 'Rename',
    description: 'Action to rename the app',
  },
  actionDuplicate: {
    id: 'appItem.actionDuplicate',
    defaultMessage: 'Duplicate',
    description: 'Action to duplicate the app',
  },
  actionDelete: {
    id: 'appItem.actionDelete',
    defaultMessage: 'Delete',
    description: 'Action to delete the app',
  },
  actionExport: {
    id: 'appItem.actionExport',
    defaultMessage: 'Export App',
    description: 'Action to export the app',
  },
  actionRunAsStartup: {
    id: 'appItem.actionRunAtStartup',
    defaultMessage: 'Run at startup',
    description: 'Label for the run at startup action',
  },
});
