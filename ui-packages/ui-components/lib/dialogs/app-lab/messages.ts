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
  createCustomBrickTitle: {
    id: 'customBrickDialog.createCustomBrickTitle',
    defaultMessage: 'Create custom brick',
    description:
      'Text for the title of the button for creating custom brick in add app brick dialog',
  },
  createCustomBrickSubtitle: {
    id: 'customBrickDialog.createCustomBrickSubtitle',
    defaultMessage: 'Create your modular software component for your project',
    description:
      'Text for the subtitle of the button for creating custom brick in add app brick dialog',
  },
  createBrickDialogTitle: {
    id: 'customBrickDialog.createBrickDialogTitle',
    defaultMessage: 'Create Brick',
    description: 'Text for the title of create brick dialog',
  },
  createBrickBodyTitle: {
    id: 'customBrickDialog.createBrickBodyTitle',
    defaultMessage: 'Give a name',
    description: 'Text for the title in the body of create brick dialog',
  },
  createBrickBodyDescription: {
    id: 'customBrickDialog.createBrickBodyDescription',
    defaultMessage:
      'A {brickFolder} will be created with a subfolder named after your Brick. It will include the default files README.txt and config.yaml.',
    description: 'Text for the description in the body of create brick dialog',
  },
  brickFolder: {
    id: 'customBrickDialog.brickFolder',
    defaultMessage: 'brick folder',
    description:
      'Text to refer to the folder that will be created for the new brick',
  },
  createButton: {
    id: 'customBrickDialog.createButton',
    defaultMessage: 'Create',
    description: 'Text for the create button in the create brick dialog',
  },
  renameBrickDialogTitle: {
    id: 'customBrickDialog.renameBrickDialogTitle',
    defaultMessage: 'Rename Brick',
    description: 'Text for the title of rename brick dialog',
  },
  renameBrickBodyTitle: {
    id: 'customBrickDialog.renameBrickBodyTitle',
    defaultMessage: `Rename {brickName}`,
    description: 'Text for the title in the body of rename brick dialog',
  },
  renameBrickBodyDescription: {
    id: 'customBrickDialog.renameBrickBodyDescription',
    defaultMessage:
      'Renaming will update the Brick folder name and ID. Make sure to update {mainPy} to match the new name, or imports may stop working.',
    description: 'Text for the description in the body of rename brick dialog',
  },
  mainPy: {
    id: 'customBrickDialog.mainPy',
    defaultMessage: 'main.py',
    description: 'Text to refer to the main.py file of the brick',
  },
  renameButton: {
    id: 'customBrickDialog.renameButton',
    defaultMessage: 'Rename',
    description: 'Text for the rename button in the rename brick dialog',
  },
  customBrickInputLabel: {
    id: 'customBrickDialog.customBrickInputLabel',
    defaultMessage: 'Brick name',
    description: 'Label for the input to set the name of the new brick',
  },
  customBrickRenameInputLabel: {
    id: 'customBrickDialog.customBrickRenameInputLabel',
    defaultMessage: 'Rename Brick',
    description: 'Label for the input to set the new name of the brick',
  },
  customBrickId: {
    id: 'customBrickDialog.customBrickId',
    defaultMessage: 'New ID: {brickId} (lowercase, no spaces)',
    description: 'Helper text for the input to set the name of the new brick',
  },
});

export const configureAppBrickDialogMessages = defineMessages({
  dialogTitle: {
    id: 'configureAppBrick.title',
    defaultMessage: 'Action required',
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
  deviceIdLabel: {
    id: 'configureAppBrick.deviceIdLabel',
    defaultMessage: 'Arduino Cloud Device ID',
    description: 'Label for the device ID input field',
  },
  deviceIdDescription: {
    id: 'configureAppBrick.deviceIdDescription',
    defaultMessage:
      'Unique identifier assigned to your physical Arduino board. You receive it during the device provisioning/setup process in the Cloud web interface.',
    description: 'Description for the device ID field',
  },
  deviceIdLink: {
    id: 'configureAppBrick.deviceIdLink',
    defaultMessage: 'Setup your Board',
    description: 'Link text for device setup instructions',
  },
  secretLabel: {
    id: 'configureAppBrick.secretLabel',
    defaultMessage: 'Arduino Cloud Secret',
    description: 'Label for the secret input field',
  },
  secretDescription: {
    id: 'configureAppBrick.secretDescription',
    defaultMessage:
      'A crucial security credential used to authenticate Arduino boards with the Arduino Cloud.',
    description: 'Description for the secret field',
  },
  secretLink: {
    id: 'configureAppBrick.secretLink',
    defaultMessage: 'Follow these instructions',
    description: 'Link text for secret setup instructions',
  },
  confirmButton: {
    id: 'configureAppBrick.confirmButton',
    defaultMessage: 'Save configuration',
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
  customBrickBodyTitle: {
    id: 'deleteAppBrickDialog.customBrickBodyTitle',
    defaultMessage: 'Delete {brickName}?',
    description: 'Message shown in the delete custom brick dialog',
  },
  customBrickBodyDescription: {
    id: 'deleteAppBrickDialog.customBrickBodyDescription',
    defaultMessage:
      'The {brickName} folder will remain, but the Brick will no longer work. You can recreate it using the same name to restore it.',
    description: 'Message to confirm the deletion of a custom brick',
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
  appNameRequired: {
    id: 'createAppDialog.appNameRequired',
    defaultMessage: 'App name is required',
    description: 'Error message when app name is empty',
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
  storageFull: {
    id: 'createAppDialog.storageFull',
    defaultMessage: 'Unable to duplicate the app. The board storage is full.',
    description:
      'Error message shown when the board storage is full and an app cannot be created or cloned',
  },
});

export const renameAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'renameAppDialog.title',
    defaultMessage: 'Rename app',
    description: 'Title shown in the rename app dialog',
  },
  inputPlaceholder: {
    id: 'renameAppDialog.inputPlaceholder',
    defaultMessage: 'Insert new name',
    description: 'Placeholder text for the app name input field',
  },
  cancelButton: {
    id: 'renameAppDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'renameAppDialog.confirmButton',
    defaultMessage: 'Rename',
    description: 'Label for the confirm button',
  },
  appNameInUse: {
    id: 'renameAppDialog.appNameInUse',
    defaultMessage: 'Name already in use, please choose another one.',
    description:
      'Error message when trying to set an app name that is already used',
  },
  successRename: {
    id: 'renameAppDialog.successRename',
    defaultMessage: 'App renamed successfully',
    description:
      'Notification message shown when an app is renamed successfully',
  },
  failedRename: {
    id: 'renameAppDialog.failedRename',
    defaultMessage: 'Failed to rename app. Please try again.',
    description: 'Notification message shown when app rename fails',
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

export const importResourceDialogMessages = defineMessages({
  titleApp: {
    id: 'app-lab.import-resource-dialog.title-app',
    defaultMessage: 'Import an App',
    description: 'Title of the import app dialog',
  },
  titleFile: {
    id: 'app-lab.import-resource-dialog.title-file',
    defaultMessage: 'Import a File',
    description: 'Title of the import file dialog',
  },
  titleFolder: {
    id: 'app-lab.import-resource-dialog.title-folder',
    defaultMessage: 'Import a Folder',
    description: 'Title of the import folder dialog',
  },
  uploadTitleApp: {
    id: 'app-lab.import-resource-dialog.upload-title-app',
    defaultMessage: 'Upload local App files',
    description: 'Title for the upload section',
  },
  uploadTitleFile: {
    id: 'app-lab.import-resource-dialog.upload-title-file',
    defaultMessage: 'Import files to your app',
    description: 'Title for the upload section',
  },
  uploadTitleFolder: {
    id: 'app-lab.import-resource-dialog.upload-title-folder',
    defaultMessage: 'Import folders to your app',
    description: 'Title for the upload section',
  },
  uploadDescriptionApp: {
    id: 'app-lab.import-resource-dialog.upload-description-app',
    defaultMessage:
      'Import an App Lab project. The app will be added to your workspace with its files, Bricks, and libraries.',
    description: 'First line of import description',
  },
  uploadDescriptionFile: {
    id: 'app-lab.import-resource-dialog.upload-description-file',
    defaultMessage:
      'Upload files from your computer to use in this app. This is useful for assets, documentation, or generated files. A file with the same name already exists. It will be replaced.',
    description: 'Description shown in the import file dialog',
  },
  uploadDescriptionFolder: {
    id: 'app-lab.import-resource-dialog.upload-description-folder',
    defaultMessage:
      'Upload folders from your computer to use in this app. This is useful for assets, documentation, or generated folders. A folder with the same name already exists. It will be replaced.',
    description: 'Description shown in the import folder dialog',
  },
  dragDropApp: {
    id: 'app-lab.import-resource-dialog.drag-drop-app',
    defaultMessage: 'Drag & drop your app here',
    description: 'Text for drag and drop area',
  },
  dragDropFile: {
    id: 'app-lab.import-resource-dialog.drag-drop-file',
    defaultMessage: 'Drag & drop your file here',
    description: 'Text for drag and drop area',
  },
  dragDropFolder: {
    id: 'app-lab.import-resource-dialog.drag-drop-folder',
    defaultMessage: 'Drag & drop your folder here',
    description: 'Text for drag and drop area',
  },
  or: {
    id: 'app-lab.import-resource-dialog.or',
    defaultMessage: 'or',
    description: 'Text between drag drop and button',
  },
  importFromComputer: {
    id: 'app-lab.import-resource-dialog.import-from-computer',
    defaultMessage: 'Import from computer',
    description: 'Button text to open file picker',
  },
  supportZip: {
    id: 'app-lab.import-resource-dialog.support-zip',
    defaultMessage: 'Only .zip files supported',
    description: 'Text indicating supported file types',
  },
  supportAnyFile: {
    id: 'app-lab.import-resource-dialog.support-any-file',
    defaultMessage: 'Any file type is supported',
    description:
      'Text indicating supported file types in the import file dialog',
  },
  supportAnyFolder: {
    id: 'app-lab.import-resource-dialog.support-any-folder',
    defaultMessage: 'Select only folder type',
    description:
      'Text indicating supported folder types in the import folder dialog',
  },
  uploadingFile: {
    id: 'app-lab.import-resource-dialog.uploading-file',
    defaultMessage: 'Uploading file',
    description: 'Text shown during upload',
  },
  uploadingFolder: {
    id: 'app-lab.import-resource-dialog.uploading-folder',
    defaultMessage: 'Uploading folder',
    description: 'Text shown during upload',
  },
  processTakesTime: {
    id: 'app-lab.import-resource-dialog.process-takes-time',
    defaultMessage: 'just few seconds...',
    description: 'Text shown during upload process',
  },
  uploadFailedApp: {
    id: 'app-lab.import-resource-dialog.upload-failed-app',
    defaultMessage: 'This App is invalid',
    description: 'Title shown when upload fails for an app',
  },
  uploadFailedFile: {
    id: 'app-lab.import-resource-dialog.upload-failed-file',
    defaultMessage: 'Upload failed',
    description: 'Title shown when upload fails for a file',
  },
  uploadFailedFolder: {
    id: 'app-lab.import-resource-dialog.upload-failed-folder',
    defaultMessage: 'Upload failed',
    description: 'Title shown when upload fails for a folder',
  },
  uploadFailedDescriptionApp: {
    id: 'app-lab.import-resource-dialog.upload-failed-description-app',
    defaultMessage: 'This app is broken or misconfigured.',
    description: 'Description shown when upload fails for an app',
  },
  uploadFailedStorageFullApp: {
    id: 'app-lab.import-resource-dialog.upload-failed-storage-full-app',
    defaultMessage: 'Unable to import the app. The board storage is full.',
    description:
      'Error shown when the board storage is full while importing an app',
  },
  uploadFailedDescriptionFile: {
    id: 'app-lab.import-resource-dialog.upload-failed-description-file',
    defaultMessage:
      'We couldn’t upload the file. Check the file and try again.',
    description: 'Description shown when upload fails for a file',
  },
  uploadFailedDescriptionFolder: {
    id: 'app-lab.import-resource-dialog.upload-failed-description-folder',
    defaultMessage:
      'We couldn’t upload the folder. Check the folder and try again.',
    description: 'Description shown when upload fails for a folder',
  },
  errorLabel: {
    id: 'app-lab.import-resource-dialog.error-label',
    defaultMessage: 'Error:',
    description: 'Label for error details',
  },
  goToMyApp: {
    id: 'app-lab.import-resource-dialog.go-to-my-app',
    defaultMessage: 'Go back to Apps',
    description: 'Button text to close error dialog',
  },
  retry: {
    id: 'app-lab.import-resource-dialog.retry',
    defaultMessage: 'Retry',
    description: 'Button text to retry upload after failure',
  },

  titleModel: {
    id: 'app-lab.import-resource-dialog.title-model',
    defaultMessage: 'Bring your own model',
    description: 'Title of the import model dialog',
  },
  uploadTitleModel: {
    id: 'app-lab.import-resource-dialog.upload-title-model',
    defaultMessage: 'Upload a Model',
    description: 'Title for the upload section in the import model dialog',
  },
  uploadDescriptionModel: {
    id: 'app-lab.import-resource-dialog.upload-description-model',
    defaultMessage:
      'Import a .gguf model file from your computer to use it in your bricks.',
    description: 'Description shown in the import model dialog',
  },
  supportGGUF: {
    id: 'app-lab.import-resource-dialog.support-gguf',
    defaultMessage: 'Only .GGUF files are supported',
    description: 'Text indicating supported file types for model import',
  },
  uploadingModel: {
    id: 'app-lab.import-resource-dialog.uploading-model',
    defaultMessage: 'Uploading model',
    description: 'Text shown during model upload',
  },
  uploadFailedModel: {
    id: 'app-lab.import-resource-dialog.upload-failed-model',
    defaultMessage: 'Upload failed',
    description: 'Title shown when upload fails for a model',
  },
  uploadFailedDescriptionModel: {
    id: 'app-lab.import-resource-dialog.upload-failed-description-model',
    defaultMessage:
      'We couldn’t upload the model. Check the model and try again.',
    description: 'Description shown when upload fails for a model',
  },
  dragDropModel: {
    id: 'app-lab.import-resource-dialog.drag-drop-model',
    defaultMessage: 'Drag and drop your model here',
    description: 'Text shown for drag and drop area for model upload',
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

export const deleteTreeItemDialogMessages = defineMessages({
  deleteFileTitle: {
    id: 'deleteTreeItemDialog.deleteFileTitle',
    defaultMessage: 'Delete File',
    description: 'Title shown in the delete file dialog',
  },
  deleteFolderTitle: {
    id: 'deleteTreeItemDialog.deleteFolderTitle',
    defaultMessage: 'Delete Folder',
    description: 'Title shown in the delete folder dialog',
  },
  dialogTitle: {
    id: 'deleteTreeItemDialog.title',
    defaultMessage: 'Delete',
    description: 'Title shown in the delete tree item dialog',
  },
  fileBodyTitle: {
    id: 'deleteTreeItemDialog.fileBodyTitle',
    defaultMessage: 'Delete {fileName}?',
    description: 'Message shown in the delete file dialog',
  },
  fileBodyDescription: {
    id: 'deleteTreeItemDialog.fileBodyDescription',
    defaultMessage: 'This will permanently delete the file',
    description: 'Message to confirm the deletion of a file',
  },
  directoryBodyTitle: {
    id: 'deleteTreeItemDialog.directoryBodyTitle',
    defaultMessage: 'Delete {fileName}?',
    description: 'Message shown in the delete directory dialog',
  },
  directoryBodyDescription: {
    id: 'deleteTreeItemDialog.directoryBodyDescription',
    defaultMessage: 'This will permanently delete the folder and all its files',
    description: 'Message to confirm the deletion of a directory',
  },
  cancelButton: {
    id: 'deleteTreeItemDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'deleteTreeItemDialog.confirmButton',
    defaultMessage: 'Yes, Delete',
    description: 'Label for the confirm button',
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

export const offlineWarningDialogMessages = defineMessages({
  dialogTitle: {
    id: 'offlineWarningDialog.title',
    defaultMessage: 'Network Connection',
    description: 'Title of the offline warning dialog',
  },
  dialogBodyTitle: {
    id: 'offlineWarningDialog.bodyTitle',
    defaultMessage: 'No internet connection detected',
    description: 'Main title shown in the offline warning dialog',
  },
  dialogBodyDescription: {
    id: 'offlineWarningDialog.bodyDescription',
    defaultMessage:
      "App Lab will still run, but some features won't be available:",
    description: 'Description shown in the offline warning dialog',
  },
  dialogBodyFooter: {
    id: 'offlineWarningDialog.bodyFooter',
    defaultMessage: 'You can connect to network now or continue offline.',
    description: 'Footer message shown in the offline warning dialog',
  },
  feature1: {
    id: 'offlineWarningDialog.feature1',
    defaultMessage: 'Updates and downloads',
    description: 'First unavailable feature',
  },
  feature2: {
    id: 'offlineWarningDialog.feature2',
    defaultMessage: 'AI models Import',
    description: 'Second unavailable feature',
  },
  feature3: {
    id: 'offlineWarningDialog.feature3',
    defaultMessage: 'Sketch libraries',
    description: 'Third unavailable feature',
  },
  feature4: {
    id: 'offlineWarningDialog.feature4',
    defaultMessage: 'Apps or Examples that requires internet connection',
    description: 'Fourth unavailable feature',
  },
  feature5: {
    id: 'offlineWarningDialog.feature5',
    defaultMessage: 'Open External links (only in SBC mode)',
    description: 'Fifth unavailable feature',
  },
  continueButton: {
    id: 'offlineWarningDialog.continueButton',
    defaultMessage: 'Continue Offline',
    description: 'Button to continue using the app offline',
  },
  networkSettingsButton: {
    id: 'offlineWarningDialog.networkSettingsButton',
    defaultMessage: 'Connect Wi-Fi',
    description: 'Button to open network settings',
  },
});

export const duplicateFileDialogMessages = defineMessages({
  fileConflictTitle: {
    id: 'duplicateFileDialog.fileConflictTitle',
    defaultMessage: 'File Conflict',
    description: 'Title shown when a file conflict is detected',
  },
  folderConflictTitle: {
    id: 'duplicateFileDialog.folderConflictTitle',
    defaultMessage: 'Folder Conflict',
    description: 'Title shown when a folder conflict is detected',
  },
  nameConflictTitle: {
    id: 'duplicateFileDialog.nameConflictTitle',
    defaultMessage: 'Name Conflict',
    description:
      'Title shown when a name conflict is detected between file and folder',
  },
  fileBodyTitle: {
    id: 'duplicateFileDialog.fileBodyTitle',
    defaultMessage: '{fileName} already exists',
    description: 'Title shown in the dialog body when a file already exists',
  },
  folderBodyTitle: {
    id: 'duplicateFileDialog.folderBodyTitle',
    defaultMessage: '{fileName} already exists',
    description: 'Title shown in the dialog body when a folder already exists',
  },
  nameConflictBodyTitle: {
    id: 'duplicateFileDialog.nameConflictBodyTitle',
    defaultMessage: '{fileName} already exists',
    description:
      'Title shown in the dialog body when a name conflict is detected between file and folder',
  },
  fileBodyDescription: {
    id: 'duplicateFileDialog.fileBodyDescription',
    defaultMessage: 'Do you want to overwrite the existing file or keep both?',
    description: 'Description shown when a file conflict is detected',
  },
  folderBodyDescription: {
    id: 'duplicateFileDialog.folderBodyDescription',
    defaultMessage:
      'A folder with this name already exists. Merge the folders or keep both as separate folders.',
    description: 'Description shown when a folder conflict is detected',
  },
  fileFolderConflictDescription: {
    id: 'duplicateFileDialog.fileFolderConflictDescription',
    defaultMessage:
      "Can't move this file. A folder with the same name already exists.",
    description:
      'Description shown when trying to move a file to a location with a folder of the same name',
  },
  folderFileConflictDescription: {
    id: 'duplicateFileDialog.folderFileConflictDescription',
    defaultMessage:
      "Can't move this folder. A file with the same name already exists.",
    description:
      'Description shown when trying to move a folder to a location with a file of the same name',
  },
  sourceLabel: {
    id: 'duplicateFileDialog.sourceLabel',
    defaultMessage: 'Source',
    description: 'Label for the source file path',
  },
  targetLabel: {
    id: 'duplicateFileDialog.targetLabel',
    defaultMessage: 'Target',
    description: 'Label for the target file path',
  },
  warningMessage: {
    id: 'duplicateFileDialog.warningMessage',
    defaultMessage:
      'Warning: Choosing "Overwrite" will permanently replace the existing {itemType}.',
    description: 'Warning message about overwriting files',
  },
  cancelButton: {
    id: 'duplicateFileDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  skipButton: {
    id: 'duplicateFileDialog.skipButton',
    defaultMessage: 'Skip',
    description: 'Label for the skip button',
  },
  overwriteButton: {
    id: 'duplicateFileDialog.overwriteButton',
    defaultMessage: 'Overwrite',
    description: 'Label for the overwrite button',
  },
  mergeButton: {
    id: 'duplicateFileDialog.mergeButton',
    defaultMessage: 'Merge',
    description: 'Label for the merge button in folder conflict',
  },
  keepBothButton: {
    id: 'duplicateFileDialog.keepBothButton',
    defaultMessage: 'Keep both',
    description: 'Label for the keep both button',
  },
  okGotItButton: {
    id: 'duplicateFileDialog.okGotItButton',
    defaultMessage: 'Ok, got it',
    description: 'Label for the ok got it button',
  },
});

export const attachCarrierDialogMessages = defineMessages({
  dialogTitle: {
    id: 'attachMediaCarrierDialog.title',
    defaultMessage: 'Attach carrier board',
    description: 'Title of the attach carrier board dialog',
  },
  dialogBodyTitle: {
    id: 'attachMediaCarrierDialog.bodyTitle',
    defaultMessage: 'Hey, before you continue...',
    description: 'Message shown in the attach media carrier board dialog',
  },
  dialogBodyDescription1: {
    id: 'attachMediaCarrierDialog.bodyDescription1',
    defaultMessage:
      'To avoid issues, connect the carrier <bold>while the board is powered off.</bold>',
    description: 'Description shown in the attach media carrier board dialog',
  },
  dialogBodyDescription2: {
    id: 'attachMediaCarrierDialog.bodyDescription2',
    defaultMessage:
      'If it’s not connected, unplug the board, attach the carrier, then come back here.',
    description: 'Description shown in the attach media carrier board dialog',
  },
  rememberButton: {
    id: 'attachMediaCarrierDialog.rememberButton',
    defaultMessage: 'Do not show it again',
    description:
      'Label for the remember button in the attach media carrier board dialog',
  },
  confirmButton: {
    id: 'attachMediaCarrierDialog.confirmButton',
    defaultMessage: 'Ok, Got it',
    description:
      'Label for the confirm button in the attach media carrier board dialog',
  },
});

export const unsupportedCarrierDialogMessages = defineMessages({
  dialogTitle: {
    id: 'unsupportedCarrierDialog.title',
    defaultMessage: 'Attention needed',
    description: 'Title of the unsupported carrier board dialog',
  },
  dialogBodyTitle: {
    id: 'unsupportedCarrierDialog.bodyTitle',
    defaultMessage: 'Update required',
    description: 'Message shown in the unsupported carrier board dialog',
  },
  dialogBodyDescription: {
    id: 'unsupportedCarrierDialog.bodyDescription',
    defaultMessage:
      'This system version doesn’t support the Media Carrier. Update your board to continue.',
    description: 'Description shown in the unsupported carrier board dialog',
  },
  confirmButton: {
    id: 'unsupportedCarrierDialog.confirmButton',
    defaultMessage: 'Update Board',
    description:
      'Label for the confirm button in the unsupported carrier board dialog',
  },
});

export const aiModelUninstallDialogMessages = defineMessages({
  dialogTitle: {
    id: 'aiModelUninstallDialog.title',
    defaultMessage: 'Uninstall',
    description: 'Title of the AI model uninstall dialog',
  },
  dialogBodyTitle: {
    id: 'aiModelUninstallDialog.bodyTitle',
    defaultMessage:
      'This AI model is currently linked to one or more other projects',
    description: 'Message shown in the AI model uninstall dialog',
  },
  dialogBodyDescription: {
    id: 'aiModelUninstallDialog.bodyDescription',
    defaultMessage:
      'The AI model will be uninstalled from all linked projects. Proceed anyway?',
    description: 'Description shown in the AI model uninstall dialog',
  },
  confirmButton: {
    id: 'aiModelUninstallDialog.confirmButton',
    defaultMessage: 'Uninstall anyway',
    description:
      'Label for the confirm button in the AI model uninstall dialog',
  },
  cancelButton: {
    id: 'aiModelUninstallDialog.cancelButton',
    defaultMessage: 'Keep the AI model',
    description: 'Label for the cancel button in the AI model uninstall dialog',
  },
});

export const aiModelRequiredDialogMessages = defineMessages({
  dialogTitle: {
    id: 'aiModelRequiredDialog.title',
    defaultMessage: 'AI Model required',
    description: 'Title of the AI model required dialog',
  },
  dialogBodyTitleApp: {
    id: 'aiModelRequiredDialog.bodyTitleApp',
    defaultMessage: 'AI model not available',
    description: 'Message shown in the AI model required dialog for apps',
  },
  dialogBodyTitleExample: {
    id: 'aiModelRequiredDialog.bodyTitleExample',
    defaultMessage: 'Download the AI model to run this example',
    description: 'Message shown in the AI model required dialog for examples',
  },
  dialogBodyDescriptionApp: {
    id: 'aiModelRequiredDialog.bodyDescriptionApp',
    defaultMessage:
      'This App needs the {modelName} AI model. Download it now to run this app or select another one.',
    description: 'Description shown in the AI model required dialog for apps',
  },
  dialogBodyDescriptionExample: {
    id: 'aiModelRequiredDialog.bodyDescriptionExample',
    defaultMessage:
      'This example needs the {modelName} AI model. Download it now to run this example.',
    description:
      'Description shown in the AI model required dialog for examples',
  },
  confirmButtonApp: {
    id: 'aiModelRequiredDialog.confirmButtonApp',
    defaultMessage: 'Select Model',
    description:
      'Label for the confirm button in the AI model required dialog for apps',
  },
  confirmButtonExample: {
    id: 'aiModelRequiredDialog.confirmButtonExample',
    defaultMessage: 'Download Model',
    description:
      'Label for the confirm button in the AI model required dialog for examples',
  },
});
