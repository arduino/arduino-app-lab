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
  trainNewModelButton: {
    id: 'brickDetail.trainNewModelButton',
    defaultMessage: 'Train new AI model',
    description: 'Label for the button to train a new AI model',
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
  trainNewModelButton: {
    id: 'brickDetail.trainNewModelButton',
    defaultMessage: 'Train new AI model',
    description: 'Label for the button to train a new AI model',
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
  successCreate: {
    id: 'createAppDialog.successCreate',
    defaultMessage: 'App created successfully',
    description:
      'Notification message shown when an app is created successfully',
  },
  failedCreate: {
    id: 'createAppDialog.failedCreate',
    defaultMessage: 'Failed to create app. Please try again.',
    description: 'Notification message shown when app creation fails',
  },
  successDuplicate: {
    id: 'createAppDialog.successDuplicate',
    defaultMessage: 'App duplicated successfully',
    description:
      'Notification message shown when an app is duplicated successfully',
  },
  failedDuplicate: {
    id: 'createAppDialog.failedDuplicate',
    defaultMessage: 'Failed to duplicate app. Please try again.',
    description: 'Notification message shown when app duplication fails',
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

export const exportAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'app-lab.export-app-dialog.title',
    defaultMessage: 'Export app',
    description: 'Title of the export app dialog',
  },
  dialogBodyTitle: {
    id: 'app-lab.export-app-dialog.body-title',
    defaultMessage: 'Export your {appName} App',
    description: 'Title in the body of the export dialog',
  },
  dialogBodyDescription: {
    id: 'app-lab.export-app-dialog.body-description',
    defaultMessage:
      'Download a package with your <strong>app code</strong>, <strong>assets</strong>, <strong>configuration</strong>, and <strong>dependencies</strong>. Share it, move it to another board, or upload it to Project Hub.',
    description: 'Description of what will be exported',
  },
  includeDataLabel: {
    id: 'app-lab.export-app-dialog.include-data-label',
    defaultMessage: 'Include data associated with the App',
    description: 'Label for the checkbox to include app data',
  },
  includeDataTooltipTitle: {
    id: 'app-lab.export-app-dialog.include-data-tooltip-title',
    defaultMessage: 'App Data',
    description: 'Title for the tooltip explaining app data inclusion',
  },
  includeDataTooltipContent: {
    id: 'app-lab.export-app-dialog.include-data-tooltip-content',
    defaultMessage:
      'When enabled, any data stored by your app will be included in the export package.',
    description: 'Content for the tooltip explaining app data inclusion',
  },
  cancelButton: {
    id: 'app-lab.export-app-dialog.cancel-button',
    defaultMessage: 'Cancel',
    description: 'Cancel button text',
  },
  confirmButton: {
    id: 'app-lab.export-app-dialog.confirm-button',
    defaultMessage: 'Export .zip',
    description: 'Confirm button text to export the app as zip',
  },
  goBackButton: {
    id: 'app-lab.export-app-dialog.go-back-button',
    defaultMessage: 'Go back to App',
    description: 'Button text to close the error dialog',
  },
  exportFailed: {
    id: 'app-lab.export-app-dialog.export-failed',
    defaultMessage: 'This App is invalid',
    description: 'Title shown when export fails',
  },
  exportFailedDescription: {
    id: 'app-lab.export-app-dialog.export-failed-description',
    defaultMessage: 'This app is broken or misconfigured.',
    description: 'Description shown when export fails',
  },
  errorLabel: {
    id: 'app-lab.export-app-dialog.error-label',
    defaultMessage: 'Error:',
    description: 'Label for error details',
  },
});

export const importAppDialogMessages = defineMessages({
  title: {
    id: 'app-lab.import-app-dialog.title',
    defaultMessage: 'Import an App',
    description: 'Title of the import app dialog',
  },
  uploadTitle: {
    id: 'app-lab.import-app-dialog.upload-title',
    defaultMessage: 'Upload local App files',
    description: 'Title for the upload section',
  },
  uploadDescriptionLine1: {
    id: 'app-lab.import-app-dialog.upload-description-line1',
    defaultMessage: 'Import an App Lab project.',
    description: 'First line of import description',
  },
  uploadDescriptionLine2: {
    id: 'app-lab.import-app-dialog.upload-description-line2',
    defaultMessage:
      'The app will be added to your workspace with its files, Bricks, and libraries.',
    description: 'Second line of import description',
  },
  dragDrop: {
    id: 'app-lab.import-app-dialog.drag-drop',
    defaultMessage: 'Drag & drop your file here',
    description: 'Text for drag and drop area',
  },
  or: {
    id: 'app-lab.import-app-dialog.or',
    defaultMessage: 'or',
    description: 'Text between drag drop and button',
  },
  importFromComputer: {
    id: 'app-lab.import-app-dialog.import-from-computer',
    defaultMessage: 'Import from computer',
    description: 'Button text to open file picker',
  },
  supportZip: {
    id: 'app-lab.import-app-dialog.support-zip',
    defaultMessage: 'Only .zip files supported',
    description: 'Text indicating supported file types',
  },
  uploadingFile: {
    id: 'app-lab.import-app-dialog.uploading-file',
    defaultMessage: 'Uploading file',
    description: 'Text shown during upload',
  },
  processTakesTime: {
    id: 'app-lab.import-app-dialog.process-takes-time',
    defaultMessage: 'just few seconds...',
    description: 'Text shown during upload process',
  },
  uploadFailed: {
    id: 'app-lab.import-app-dialog.upload-failed',
    defaultMessage: 'This App is invalid',
    description: 'Title shown when upload fails',
  },
  uploadFailedDescription: {
    id: 'app-lab.import-app-dialog.upload-failed-description',
    defaultMessage: 'This app is broken or misconfigured.',
    description: 'Description shown when upload fails',
  },
  errorLabel: {
    id: 'app-lab.import-app-dialog.error-label',
    defaultMessage: 'Error:',
    description: 'Label for error details',
  },
  goToMyApp: {
    id: 'app-lab.import-app-dialog.go-to-my-app',
    defaultMessage: 'Go back to Apps',
    description: 'Button text to close error dialog',
  },
});

export const skipLoginDialogMessages = defineMessages({
  dialogTitle: {
    id: 'skipLoginDialog.title',
    defaultMessage: 'Log In',
    description: 'Title shown in the skip Arduino account dialog',
  },
  dialogBodyTitle: {
    id: 'skipLoginDialog.bodyTitle',
    defaultMessage: `Are you sure you want to skip this?`,
    description: 'Message shown in the skip Arduino account dialog',
  },
  dialogBodyDescription: {
    id: 'skipLoginDialog.bodyDescription',
    defaultMessage: `Signing in with your Arduino account unlocks App Lab's full potential, giving you:`,
    description: 'Message shown in the skip Arduino account dialog',
  },
  dialogBodyListItem1: {
    id: 'skipLoginDialog.bodyListItem1',
    defaultMessage: 'Advanced AI models with custom training capabilities',
    description: 'Message to confirm the skip Arduino account dialog',
  },
  dialogBodyListItem2: {
    id: 'skipLoginDialog.bodyListItem2',
    defaultMessage: 'Additional Arduino courses and learning materials',
    description: 'Message to confirm the skip Arduino account dialog',
  },
  dialogBodyListItem3: {
    id: 'skipLoginDialog.bodyListItem3',
    defaultMessage: 'Seamless integration with Arduino Cloud',
    description: 'Message to confirm the skip Arduino account dialog',
  },
  dialogBodyListItem4: {
    id: 'skipLoginDialog.bodyListItem4',
    defaultMessage: 'A growing library of additional apps',
    description: 'Message to confirm the skip Arduino account dialog',
  },
  dialogBodyFooter: {
    id: 'skipLoginDialog.bodyFooter',
    defaultMessage: `And as always, it's all completely free!`,
    description: 'Message shown in the skip Arduino account dialog',
  },
  skipButton: {
    id: 'skipLoginDialog.skipButton',
    defaultMessage: 'Skip Log In',
    description: 'Label for the skip button',
  },
  confirmButton: {
    id: 'skipLoginDialog.confirmButton',
    defaultMessage: 'Log In with Arduino',
    description: 'Label for the confirm button',
  },
});

export const trainNewModelDialogMessages = defineMessages({
  trainModelWelcomeTitle: {
    id: 'appLabBrickDetail.trainNewModel.welcomeTitle',
    defaultMessage: 'Train your own custom AI models',
    description: 'Welcome title for the train new model section',
  },
  trainModelWelcomeDescriptionOne: {
    id: 'appLabBrickDetail.trainNewModel.welcomeDescriptionOne',
    defaultMessage: ` You’ll be redirected to the {bold} platform in your browser.`,
    description: 'Welcome description for the train new model section',
  },
  edgeImpulseStudio: {
    id: 'appLabBrickDetail.trainNewModel.edgeImpulseStudio',
    defaultMessage: 'Edge Impulse Studio',
    description: 'Name of the platform used to train new models',
  },
  trainModelWelcomeDescriptionTwo: {
    id: 'appLabBrickDetail.trainNewModel.welcomeDescriptionTwo',
    defaultMessage: ' Train and finalise your model there.',
    description: 'Welcome description for the train new model section',
  },
  trainModelWelcomeDescriptionThree: {
    id: 'appLabBrickDetail.trainNewModel.welcomeDescriptionThree',
    defaultMessage: ` Back in App Lab, you’ll find your new model inside the suitable {bold} — ready to install and use.`,
    description: 'Welcome description for the train new model section',
  },
  arduinoAiBrick: {
    id: 'appLabBrickDetail.trainNewModel.arduinoAiBrick',
    defaultMessage: 'Arduino AI Brick',
    description: 'Name of the section where the new model will be available',
  },
  dontShowAgain: {
    id: 'appLabBrickDetail.trainNewModel.dontShowAgain',
    defaultMessage: 'Don’t show it anymore',
    description: 'Checkbox label to not show the welcome message again',
  },
  trainModelTitle: {
    id: 'appLabBrickDetail.trainNewModel.title',
    defaultMessage: 'Train your AI Model with Edge Impulse Studio',
    description: 'Title for the train new model section',
  },
  trainModelDescription: {
    id: 'appLabBrickDetail.trainNewModel.description',
    defaultMessage: 'Follow these steps to get started:',
    description: 'Description for the train new model section',
  },
  stepOne: {
    id: 'appLabBrickDetail.trainNewModel.stepOne',
    defaultMessage: 'Sign in or create your Arduino account',
    description: 'Step one instruction for training new model',
  },
  stepTwo: {
    id: 'appLabBrickDetail.trainNewModel.stepTwo',
    defaultMessage: 'Continue in Edge Impulse using your Arduino Account',
    description: 'Step two instruction for training new model',
  },
  arduinoSignIn: {
    id: 'appLabBrickDetail.trainNewModel.arduinoSignIn',
    defaultMessage: 'Arduino Sign in',
    description: 'Button text to sign in with Arduino account',
  },
  connectToEdgeImpulse: {
    id: 'appLabBrickDetail.trainNewModel.connectToEdgeImpulse',
    defaultMessage: 'Connect to Edge Impulse Studio',
    description: 'Button text to connect to Edge Impulse',
  },
  accountConnectedTitle: {
    id: 'appLabBrickDetail.trainNewModel.accountConnectedTitle',
    defaultMessage: 'Your Arduino Account is now connected to Edge Impulse 🎉',
    description: 'Title shown when the account is successfully connected',
  },
  redirectToEdgeImpulse: {
    id: 'appLabBrickDetail.trainNewModel.redirectToEdgeImpulse',
    defaultMessage: 'You will be redirected to Edge Impulse Studio',
    description: 'Instruction shown when the account is successfully connected',
  },
  chooseModelType: {
    id: 'appLabBrickDetail.trainNewModel.chooseModelType',
    defaultMessage:
      'Choose to train a model using a tutorial or start from scratch',
    description: 'Instruction shown when the account is successfully connected',
  },
  modelInAppLab: {
    id: 'appLabBrickDetail.trainNewModel.modelInAppLab',
    defaultMessage:
      'The new AI model will automatically appear in App Lab, ready to install from its corresponding bricks.',
    description: 'Instruction shown when the account is successfully connected',
  },
  startToTrainButton: {
    id: 'appLabBrickDetail.trainNewModel.startToTrainButton',
    defaultMessage: 'Start to Train your AI model',
    description: 'Button text to start training the new model',
  },
  exitDialog: {
    id: 'appLabBrickDetail.trainNewModel.exitDialog',
    defaultMessage: 'Exit',
    description: 'Button text to exit the train new model dialog',
  },
  letsStart: {
    id: 'appLabBrickDetail.trainNewModel.letsStart',
    defaultMessage: `Ok, let's start`,
    description: 'Button to start train new model',
  },
  learnMore: {
    id: 'appLabBrickDetail.trainNewModel.learnMore',
    defaultMessage: 'Learn More',
    description: 'Button to learn more',
  },
});

export const networkSettingsDialogMessages = defineMessages({
  dialogTitle: {
    id: 'networkSettingsDialog.title',
    defaultMessage: 'Network Settings',
    description: 'Title of the network settings dialog',
  },
  confirmButton: {
    id: 'networkSettingsDialog.confirmButton',
    defaultMessage: 'Connect',
    description: 'Label for the button to confirm network settings dialog',
  },
});

export const disableNetworkModeDialogMessages = defineMessages({
  dialogTitle: {
    id: 'disableNetworkModeDialog.title',
    defaultMessage: 'Remote access (SSH)',
    description: 'Title of the disable network mode dialog',
  },
  dialogBodyTitle: {
    id: 'disableNetworkModeDialog.bodyTitle',
    defaultMessage: 'Disable remote access?',
    description: 'Message shown in the disable network mode dialog',
  },
  dialogBodyDescription: {
    id: 'disableNetworkModeDialog.bodyDescription',
    defaultMessage:
      'Turning off Remote Access (SSH) will prevent App Lab from connecting to your board over the network.',
    description:
      'Description shown in the disable network mode dialog to explain the consequences of disabling network mode',
  },
  cancelButton: {
    id: 'disableNetworkModeDialog.cancelButton',
    defaultMessage: 'Cancel',
    description:
      'Label for the cancel button in the disable network mode dialog',
  },
  confirmButton: {
    id: 'disableNetworkModeDialog.confirmButton',
    defaultMessage: 'Disable',
    description:
      'Label for the confirm button in the disable network mode dialog',
  },
});
