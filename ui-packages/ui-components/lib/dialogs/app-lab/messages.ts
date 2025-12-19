import { defineMessages } from 'react-intl';

export const addAppBrickDialogMessages = defineMessages({
  dialogTitle: {
    id: 'addAppBrick.title',
    defaultMessage: 'Add App Brick',
    description: 'Title of add app brick dialog',
  },
  successTitle: {
    id: 'addAppBrick.successTitle',
    defaultMessage: 'Success',
    description: 'Title shown when an app brick is successfully added',
  },
  successDescription: {
    id: 'addAppBrick.successDescription',
    defaultMessage: 'Next steps:',
    description: 'Description shown when an app brick is successfully added',
  },
  successStep1: {
    id: 'addAppBrick.successStep1',
    defaultMessage: 'Check <bold>usage examples</bold>',
    description: 'First step shown when an app brick is successfully added',
  },
  successStep2: {
    id: 'addAppBrick.successStep2',
    defaultMessage:
      '<bold>Copy</bold> the code you need in <bold>main.py</bold>',
    description: 'Second step shown when an app brick is successfully added',
  },
  cancelButton: {
    id: 'addAppBrick.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Text for cancel button in add app brick dialog',
  },
  confirmButton: {
    id: 'addAppBrick.confirmButton',
    defaultMessage: 'Add brick',
    description: 'Text for confirm button in add app brick dialog',
  },
  checkButton: {
    id: 'addAppBrick.checkButton',
    defaultMessage: 'Check usage examples',
    description: 'Text for check usage examples button in add app brick dialog',
  },
});

export const configureAppBrickDialogMessages = defineMessages({
  dialogTitle: {
    id: 'configureAppBrick.title',
    defaultMessage: 'Configure',
    description: 'Title of configure app brick dialog',
  },
  dialogBodyDescription: {
    id: 'configureAppBricks.bodyDescription',
    defaultMessage:
      '* Fields marked with an asterisk (*) are mandatory, leaving them empty will prevent the app from running.',
    description: 'Message to confirm the deletion of a brick',
  },
  dialogBodySubtitle: {
    id: 'configureAppBrick.bodySubtitle',
    defaultMessage: 'Compatible AI Models',
    description: 'Subtitle message shown in the configure app brick dialog',
  },
  cancelButton: {
    id: 'configureAppBrick.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Text for cancel button in configure app brick dialog',
  },
  confirmButton: {
    id: 'configureAppBrick.confirmButton',
    defaultMessage: 'Save',
    description: 'Text for confirm button in configure app brick dialog',
  },
});

export const configureAppBricksDialogMessages = defineMessages({
  dialogTitle: {
    id: 'configureAppBricks.title',
    defaultMessage: 'Action required',
    description: 'Title of configure app bricks dialog',
  },
  dialogBodyTitle: {
    id: 'configureAppBricks.bodyTitle',
    defaultMessage: '{brickName} requires mandatory configuration to RUN',
    description: 'Message shown in the delete brick dialog',
  },
  dialogBodyDescription: {
    id: 'configureAppBricks.bodyDescription',
    defaultMessage:
      'You can always change these parameters later from Brick Configuration.',
    description: 'Message to confirm the deletion of a brick',
  },
  dialogBodySubtitle: {
    id: 'configureAppBricks.bodySubtitle',
    defaultMessage: 'Compatible AI Models',
    description: 'Subtitle message shown in the configure app brick dialog',
  },
  cancelButton: {
    id: 'configureAppBricks.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Text for cancel button in configure app bricks dialog',
  },
  confirmButton: {
    id: 'configureAppBricks.confirmButton',
    defaultMessage: 'Save and run',
    description: 'Text for confirm button in configure app bricks dialog',
  },
});

export const deleteAppBrickDialogMessages = defineMessages({
  dialogTitle: {
    id: 'deleteAppBrickDialog.title',
    defaultMessage: 'Delete brick',
    description: 'Title shown in the delete brick dialog',
  },
  dialogBodyTitle: {
    id: 'deleteAppBrickDialog.bodyTitle',
    defaultMessage: 'Are you sure you want to remove this Brick?',
    description: 'Message shown in the delete brick dialog',
  },
  dialogBodyDescription: {
    id: 'deleteAppBrickDialog.bodyDescription',
    defaultMessage: 'All the configurations will be lost',
    description: 'Message to confirm the deletion of a brick',
  },
  cancelButton: {
    id: 'deleteAppBrickDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'deleteAppBrickDialog.confirmButton',
    defaultMessage: 'Delete',
    description: 'Label for the confirm button',
  },
});

export const swapRunningAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'swapRunningApp.title',
    defaultMessage: 'Swap Running App',
    description: 'Title of swap running app dialog',
  },
  dialogBodyTitle: {
    id: 'swapRunningApp.bodyTitle',
    defaultMessage: 'You’re about to change the app for this run',
    description: 'Body title of swap running app dialog',
  },
  dialogBodyDescription: {
    id: 'swapRunningApp.bodyDescription',
    defaultMessage:
      'You’re about to replace the app currently linked to this run with a new one. This may affect how the run behaves. Please make sure you want to proceed',
    description: 'Body description of swap running app dialog',
  },
  cancelButton: {
    id: 'swapRunningApp.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Text for cancel button in swap running app dialog',
  },
  confirmButton: {
    id: 'swapRunningApp.confirmButton',
    defaultMessage: 'Confirm and replace',
    description: 'Text for confirm button in swap running app dialog',
  },
});

export const deleteAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'deleteAppDialog.title',
    defaultMessage: 'Delete app',
    description: 'Title shown in the delete app dialog',
  },
  dialogBodyTitle: {
    id: 'deleteAppDialog.bodyTitle',
    defaultMessage: 'Are you sure you want to delete\n{appName}?',
    description: 'Message shown in the delete app dialog',
  },
  dialogBodyDescription: {
    id: 'deleteAppDialog.bodyDescription',
    defaultMessage: 'This action cannot be undone',
    description: 'Message to confirm the deletion of an app',
  },
  cancelButton: {
    id: 'deleteAppDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'deleteAppDialog.confirmButton',
    defaultMessage: 'Delete',
    description: 'Label for the confirm button',
  },
});

export const createAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'createAppDialog.title',
    defaultMessage: 'Create new app',
    description: 'Title shown in the create app dialog',
  },
  inputPlaceholder: {
    id: 'createAppDialog.inputPlaceholder',
    defaultMessage: 'Insert title',
    description: 'Placeholder text for the app name input field',
  },
  cancelButton: {
    id: 'createAppDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'createAppDialog.confirmButton',
    defaultMessage: 'Create new',
    description: 'Label for the confirm button',
  },
  appNameInUse: {
    id: 'createAppDialog.appNameInUse',
    defaultMessage: 'Name already in use, please choose another one.',
    description:
      'Error message when trying to set an app name that is already used',
  },
});

export const setAsDefaultAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'setAsDefaultAppDialog.title',
    defaultMessage: 'Set as default',
    description: 'Title shown in the set as default app dialog',
  },
  dialogBodyTitle: {
    id: 'setAsDefaultAppDialog.bodyTitle',
    defaultMessage: 'Do you want to set this app as the default?',
    description: 'Message shown in the set as default app dialog',
  },
  dialogBodyDescription: {
    id: 'setAsDefaultAppDialog.bodyDescription',
    defaultMessage:
      'It will automatically launch every time the board is powered on.',
    description: 'Message to confirm the set as default of an app',
  },
  cancelButton: {
    id: 'setAsDefaultAppDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'setAsDefaultAppDialog.confirmButton',
    defaultMessage: 'Set as default',
    description: 'Label for the confirm button',
  },
});

export const addSketchLibraryDialogMessages = defineMessages({
  dialogTitle: {
    id: 'addSketchLibrary.title',
    defaultMessage: 'Add sketch library',
    description: 'Title of the library search dialog',
  },
  searchPlaceholder: {
    id: 'addSketchLibrary.search',
    defaultMessage: 'Search library',
    description: 'Placeholder for the text input in the library search dialog',
  },
});
