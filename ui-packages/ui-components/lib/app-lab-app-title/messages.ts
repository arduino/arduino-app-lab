import { defineMessages } from 'react-intl';

export const appTitleMessages = defineMessages({
  actionRename: {
    id: 'appTitle.actionRename',
    defaultMessage: 'Rename',
    description: 'Rename the app',
  },
  actionDuplicate: {
    id: 'appTitle.actionDuplicate',
    defaultMessage: 'Duplicate',
    description: 'Duplicate the app',
  },
  actionDelete: {
    id: 'appTitle.actionDelete',
    defaultMessage: 'Delete',
    description: 'Delete the app',
  },
  appDefault: {
    id: 'appTitle.appDefault',
    defaultMessage: 'Default',
    description: 'Indicates that the app is the default one',
  },
  appNameInUse: {
    id: 'appTitle.appNameInUse',
    defaultMessage: 'Name already in use, please choose another one.',
    description:
      'Error message when trying to set an app name that is already used',
  },
});
