import { defineMessages } from 'react-intl';

export const addAppBrickDialogMessages = defineMessages({
  dialogTitle: {
    id: 'addAppBrick.title',
    defaultMessage: 'Add Brick',
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
    defaultMessage: 'Add',
    description: 'Text for confirm button in add app brick dialog',
  },
  checkButton: {
    id: 'addAppBrick.checkButton',
    defaultMessage: 'Check usage examples',
    description: 'Text for check usage examples button in add app brick dialog',
  },
  createCustomBrickTitle: {
    id: 'customBrickDialog.createCustomBrickTitle',
    defaultMessage: 'Create custom Brick',
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
    defaultMessage: 'Brick folder',
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
    defaultMessage: 'Rename',
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
      '* Fields marked with an asterisk (*) are mandatory, leaving them empty will prevent the App from running.',
    description: 'Message to confirm the deletion of a brick',
  },
  deviceIdLabel: {
    id: 'configureAppBrick.deviceIdLabel',
    defaultMessage: 'Arduino Cloud device ID',
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
    defaultMessage: 'Setup your board',
    description: 'Link text for device setup instructions',
  },
  secretLabel: {
    id: 'configureAppBrick.secretLabel',
    defaultMessage: 'Arduino Cloud secret',
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
      'You can always change these parameters later from Brick configuration.',
    description: 'Message to confirm the deletion of a brick',
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
    defaultMessage: 'Delete Brick',
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
    defaultMessage: 'Swap running App',
    description: 'Title of swap running app dialog',
  },
  dialogBodyTitle: {
    id: 'swapRunningApp.bodyTitle',
    defaultMessage:
      'Stop <running>{runningAppName}</running> and run <new>{newAppName}</new>?',
    description:
      'Body title of swap running app dialog; the tags wrap the two App names',
  },
  dialogBodyDescription: {
    id: 'swapRunningApp.bodyDescription',
    defaultMessage:
      '<running>{runningAppName}</running> will stop and <new>{newAppName}</new> will start.',
    description:
      'Body description of swap running app dialog; the tags wrap the two App names',
  },
  defaultAppNote: {
    id: 'swapRunningApp.defaultAppNote',
    defaultMessage:
      '<running>{runningAppName}</running> stays your default App and will run again the next time you power your board.',
    description:
      'Added to the swap running app dialog body when the running App is the default App',
  },
  cancelButton: {
    id: 'swapRunningApp.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Text for cancel button in swap running app dialog',
  },
  confirmButton: {
    id: 'swapRunningApp.confirmButton',
    defaultMessage: 'Stop and run',
    description: 'Text for confirm button in swap running app dialog',
  },
});

export const deleteAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'deleteAppDialog.title',
    defaultMessage: 'Delete App',
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
    defaultMessage: 'Create new App',
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
  appNameInvalidChars: {
    id: 'createAppDialog.appNameInvalidChars',
    defaultMessage:
      'Invalid name. Use letters, numbers, spaces, dots, dashes and underscores.',
    description: 'Error message when app name contains invalid characters',
  },
  successCreate: {
    id: 'createAppDialog.successCreate',
    defaultMessage: 'App created successfully',
    description:
      'Notification message shown when an app is created successfully',
  },
  failedCreate: {
    id: 'createAppDialog.failedCreate',
    defaultMessage: 'Failed to create App. Please try again.',
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
    defaultMessage: 'Failed to duplicate App. Please try again.',
    description: 'Notification message shown when app duplication fails',
  },
  storageFull: {
    id: 'createAppDialog.storageFull',
    defaultMessage: 'Unable to duplicate the App. The board storage is full.',
    description:
      'Error message shown when the board storage is full and an app cannot be created or cloned',
  },
});

export const renameAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'renameAppDialog.title',
    defaultMessage: 'Rename App',
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
  appNameInvalidChars: {
    id: 'renameAppDialog.appNameInvalidChars',
    defaultMessage:
      'Invalid name. Use letters, numbers, spaces, dots, dashes and underscores.',
    description: 'Error message when app name contains invalid characters',
  },
  successRename: {
    id: 'renameAppDialog.successRename',
    defaultMessage: 'App renamed successfully',
    description:
      'Notification message shown when an app is renamed successfully',
  },
  failedRename: {
    id: 'renameAppDialog.failedRename',
    defaultMessage: 'Failed to rename App. Please try again.',
    description: 'Notification message shown when app rename fails',
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
  noLibrariesFound: {
    id: 'addSketchLibrary.noLibrariesFound',
    defaultMessage: 'No libraries found',
    description:
      'Shown in the library search dialog when a search has no results',
  },
  searchError: {
    id: 'addSketchLibrary.searchError',
    defaultMessage:
      'Libraries could not be loaded. Check that the board is connected to the internet, then try again.',
    description:
      'Shown in the library search dialog when the search request fails or gets no reply',
  },
  retryButton: {
    id: 'addSketchLibrary.retry',
    defaultMessage: 'Try again',
    description:
      'Button in the library search dialog that repeats a failed search',
  },
});

export const publishAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'publishAppDialog.title',
    defaultMessage: 'Publish on Project Hub',
    description: 'Title of the publish app dialog',
  },
  dialogBodyTitle: {
    id: 'publishAppDialog.bodyTitle',
    defaultMessage: 'Draft now, publish later',
    description: 'Title in the body of the publish dialog',
  },
  dialogBodyDescription: {
    id: 'publishAppDialog.bodyDescription',
    defaultMessage:
      "Sign in or create an Arduino account to get started. Your project will be imported automatically <strong>as a draft</strong>: you'll fill in a few remaining fields and submit it yourself on Project Hub.",
    description: 'Description of what will be published',
  },
  includeDataLabel: {
    id: 'publishAppDialog.includeDataLabel',
    defaultMessage: 'Include data associated with the App',
    description: 'Label for the checkbox to include app data',
  },
  includeDataTooltipTitle: {
    id: 'publishAppDialog.includeDataTooltipTitle',
    defaultMessage: 'App data',
    description: 'Title for the tooltip explaining app data inclusion',
  },
  includeDataTooltipContent: {
    id: 'publishAppDialog.includeDataTooltipContent',
    defaultMessage:
      'When enabled, any data stored by your App will be included in the export package.',
    description: 'Content for the tooltip explaining app data inclusion',
  },
  confirmButton: {
    id: 'publishAppDialog.confirmButton',
    defaultMessage: 'Upload as draft',
    description: 'Confirm button text to upload the app as a Project Hub draft',
  },
});

export const publishAppMessages = defineMessages({
  operationTitle: {
    id: 'publishApp.operationTitle',
    defaultMessage: 'Uploading {appName} on Project Hub',
    description: 'Title of the banner reporting the upload progress',
  },
  operationDescription: {
    id: 'publishApp.operationDescription',
    defaultMessage:
      "We're uploading your project and preparing a draft. This may take a while, your browser will open when it's ready.",
    description: 'Explanation of what the upload is doing',
  },
  phaseExporting: {
    id: 'publishApp.phaseExporting',
    defaultMessage: 'Exporting project…',
    description: 'Progress step while the app package is being built',
  },
  phaseUploading: {
    id: 'publishApp.phaseUploading',
    defaultMessage: 'Uploading to Project Hub…',
    description: 'Progress step while the package is being uploaded',
  },
  abortAction: {
    id: 'publishApp.abortAction',
    defaultMessage: 'Abort upload',
    description: 'Overflow menu entry that stops the upload to Project Hub',
  },
  abortedNotification: {
    id: 'publishApp.abortedNotification',
    defaultMessage: 'Draft upload successfully aborted.',
    description: 'Confirmation shown after the user aborts the upload',
  },
  successNotification: {
    id: 'publishApp.successNotification',
    defaultMessage: 'Draft created. Taking you to Project Hub.',
    description: 'Confirmation shown once the draft has been created',
  },
  successNotificationAction: {
    id: 'publishApp.successNotificationAction',
    defaultMessage: 'OPEN',
    description: 'Action that opens the newly created Project Hub draft',
  },
  errorNotification: {
    id: 'publishApp.errorNotification',
    defaultMessage: "Couldn't upload your draft to Project Hub.",
    description: 'Error shown when the upload to Project Hub fails',
  },
  errorNotificationAction: {
    id: 'publishApp.errorNotificationAction',
    defaultMessage: 'RETRY',
    description: 'Action that retries the failed upload',
  },
});

export const exportAppDialogMessages = defineMessages({
  dialogTitle: {
    id: 'app-lab.export-app-dialog.title',
    defaultMessage: 'Export App',
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
      'Download a package with your <strong>App code</strong>, <strong>assets</strong>, <strong>configuration</strong>, and <strong>dependencies</strong>. Share it, move it to another board, or upload it to Project Hub.',
    description: 'Description of what will be exported',
  },
  includeDataLabel: {
    id: 'app-lab.export-app-dialog.include-data-label',
    defaultMessage: 'Include data associated with the App',
    description: 'Label for the checkbox to include app data',
  },
  includeDataTooltipTitle: {
    id: 'app-lab.export-app-dialog.include-data-tooltip-title',
    defaultMessage: 'App data',
    description: 'Title for the tooltip explaining app data inclusion',
  },
  includeDataTooltipContent: {
    id: 'app-lab.export-app-dialog.include-data-tooltip-content',
    defaultMessage:
      'When enabled, any data stored by your App will be included in the export package.',
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
    defaultMessage: 'This App is broken or misconfigured.',
    description: 'Description shown when export fails',
  },
});

export const importResourceDialogMessages = defineMessages({
  titleApp: {
    id: 'app-lab.import-resource-dialog.title-app',
    defaultMessage: 'Import or install an App',
    description: 'Title of the import app dialog',
  },
  enablePreparationDescription: {
    id: 'app-lab.import-resource-dialog.enable-preparation-description',
    defaultMessage:
      'Will download all the dependencies of the app (containers, bricks, other data) so that the app release is then ready to be quickly launched.',
    description: 'Explains what enabling preparation does',
  },
  trustWarning: {
    id: 'app-lab.import-resource-dialog.trust-warning',
    defaultMessage:
      "'.ard' can run any command on this device, with full access to the system. Only install App Releases from sources you trust.",
    description:
      'Warning shown before installing a release, about the access an .ard file has',
  },
  installButton: {
    id: 'app-lab.import-resource-dialog.install-button',
    defaultMessage: 'Install',
    description: 'Label of the button that installs the picked release',
  },
  cancelButton: {
    id: 'app-lab.import-resource-dialog.cancel-button',
    defaultMessage: 'Cancel',
    description: 'Label of the button that abandons the release install',
  },
  installingButton: {
    id: 'app-lab.import-resource-dialog.installing-button',
    defaultMessage: 'Installing',
    description: 'Label of the install button while the release is installed',
  },
  supportedFormat: {
    id: 'app-lab.import-resource-dialog.supported-format',
    defaultMessage: 'Supported format',
    description: 'Label above the file types the app import accepts',
  },
  titleFile: {
    id: 'app-lab.import-resource-dialog.title-file',
    defaultMessage: 'Import a file',
    description: 'Title of the import file dialog',
  },
  titleFolder: {
    id: 'app-lab.import-resource-dialog.title-folder',
    defaultMessage: 'Import a folder',
    description: 'Title of the import folder dialog',
  },
  uploadTitleApp: {
    id: 'app-lab.import-resource-dialog.upload-title-app',
    defaultMessage: 'Upload local App files',
    description: 'Title for the upload section',
  },
  uploadTitleFile: {
    id: 'app-lab.import-resource-dialog.upload-title-file',
    defaultMessage: 'Import files to your App',
    description: 'Title for the upload section',
  },
  uploadTitleFolder: {
    id: 'app-lab.import-resource-dialog.upload-title-folder',
    defaultMessage: 'Import folders to your App',
    description: 'Title for the upload section',
  },
  uploadDescriptionApp: {
    id: 'app-lab.import-resource-dialog.upload-description-app',
    defaultMessage:
      'Import an App Lab project or install a release. The App will be added to your workspace with its files, Bricks, and libraries.',
    description: 'First line of import description',
  },
  uploadDescriptionFile: {
    id: 'app-lab.import-resource-dialog.upload-description-file',
    defaultMessage:
      'Upload files from your computer to use in this App. This is useful for assets, documentation, or generated files. A file with the same name already exists. It will be replaced.',
    description: 'Description shown in the import file dialog',
  },
  uploadDescriptionFolder: {
    id: 'app-lab.import-resource-dialog.upload-description-folder',
    defaultMessage:
      'Upload folders from your computer to use in this App. This is useful for assets, documentation, or generated folders. A folder with the same name already exists. It will be replaced.',
    description: 'Description shown in the import folder dialog',
  },
  dragDropApp: {
    id: 'app-lab.import-resource-dialog.drag-drop-app',
    defaultMessage: 'Drag & drop your App here',
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
    defaultMessage: 'process takes just few seconds...',
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
    defaultMessage: 'This App is broken or misconfigured.',
    description: 'Description shown when upload fails for an app',
  },
  uploadFailedStorageFullApp: {
    id: 'app-lab.import-resource-dialog.upload-failed-storage-full-app',
    defaultMessage: 'Unable to import the App. The board storage is full.',
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
});

export const skipLoginDialogMessages = defineMessages({
  dialogTitle: {
    id: 'skipLoginDialog.title',
    defaultMessage: 'Log in',
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
    defaultMessage: 'Advanced AI Models with custom training capabilities',
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
    defaultMessage: 'A growing library of additional Apps',
    description: 'Message to confirm the skip Arduino account dialog',
  },
  dialogBodyFooter: {
    id: 'skipLoginDialog.bodyFooter',
    defaultMessage: `And as always, it's all completely free!`,
    description: 'Message shown in the skip Arduino account dialog',
  },
  skipButton: {
    id: 'skipLoginDialog.skipButton',
    defaultMessage: 'Skip log in',
    description: 'Label for the skip button',
  },
  confirmButton: {
    id: 'skipLoginDialog.confirmButton',
    defaultMessage: 'Log in with Arduino',
    description: 'Label for the confirm button',
  },
});

export const trainNewModelDialogMessages = defineMessages({
  trainModelWelcomeTitle: {
    id: 'appLabBrickDetail.trainNewModel.welcomeTitle',
    defaultMessage: 'Train your own custom AI Models',
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
    defaultMessage: 'Continue in Edge Impulse using your Arduino account',
    description: 'Step two instruction for training new model',
  },
  arduinoSignIn: {
    id: 'appLabBrickDetail.trainNewModel.arduinoSignIn',
    defaultMessage: 'Arduino sign in',
    description: 'Button text to sign in with Arduino account',
  },
  connectToEdgeImpulse: {
    id: 'appLabBrickDetail.trainNewModel.connectToEdgeImpulse',
    defaultMessage: 'Connect to Edge Impulse Studio',
    description: 'Button text to connect to Edge Impulse',
  },
  accountConnectedTitle: {
    id: 'appLabBrickDetail.trainNewModel.accountConnectedTitle',
    defaultMessage: 'Your Arduino account is now connected to Edge Impulse 🎉',
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
      'The new AI Model will automatically appear in App Lab, ready to install from its corresponding Bricks.',
    description: 'Instruction shown when the account is successfully connected',
  },
  startToTrainButton: {
    id: 'appLabBrickDetail.trainNewModel.startToTrainButton',
    defaultMessage: 'Start to train your AI Model',
    description: 'Button text to start training the new model',
  },
  exitDialog: {
    id: 'appLabBrickDetail.trainNewModel.exitDialog',
    defaultMessage: 'Exit',
    description: 'Button text to exit the train new model dialog',
  },
  letsStart: {
    id: 'appLabBrickDetail.trainNewModel.letsStart',
    defaultMessage: `OK, let's start`,
    description: 'Button to start train new model',
  },
  learnMore: {
    id: 'appLabBrickDetail.trainNewModel.learnMore',
    defaultMessage: 'Learn more',
    description: 'Button to learn more',
  },
});

export const networkSettingsDialogMessages = defineMessages({
  dialogTitle: {
    id: 'networkSettingsDialog.title',
    defaultMessage: 'Network settings',
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
    defaultMessage: 'Delete file',
    description: 'Title shown in the delete file dialog',
  },
  deleteFolderTitle: {
    id: 'deleteTreeItemDialog.deleteFolderTitle',
    defaultMessage: 'Delete folder',
    description: 'Title shown in the delete folder dialog',
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
    defaultMessage: 'Yes, delete',
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
      'Turning off remote access (SSH) will prevent App Lab from connecting to your board over the network.',
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
    defaultMessage: 'Network connection',
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
    defaultMessage: 'AI Models import',
    description: 'Second unavailable feature',
  },
  feature3: {
    id: 'offlineWarningDialog.feature3',
    defaultMessage: 'Sketch libraries',
    description: 'Third unavailable feature',
  },
  feature4: {
    id: 'offlineWarningDialog.feature4',
    defaultMessage: 'Apps or examples that require internet connection',
    description: 'Fourth unavailable feature',
  },
  feature5: {
    id: 'offlineWarningDialog.feature5',
    defaultMessage: 'Open external links (only in SBC mode)',
    description: 'Fifth unavailable feature',
  },
  continueButton: {
    id: 'offlineWarningDialog.continueButton',
    defaultMessage: 'Continue offline',
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
    defaultMessage: 'File conflict',
    description: 'Title shown when a file conflict is detected',
  },
  folderConflictTitle: {
    id: 'duplicateFileDialog.folderConflictTitle',
    defaultMessage: 'Folder conflict',
    description: 'Title shown when a folder conflict is detected',
  },
  nameConflictTitle: {
    id: 'duplicateFileDialog.nameConflictTitle',
    defaultMessage: 'Name conflict',
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
      'Do you want to overwrite the existing folder or keep both?',
    description: 'Description shown when a folder conflict is detected',
  },
  fileFolderConflictDescription: {
    id: 'duplicateFileDialog.fileFolderConflictDescription',
    defaultMessage:
      "Can't move this file. A folder with this name already exists.",
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
  overwriteButton: {
    id: 'duplicateFileDialog.overwriteButton',
    defaultMessage: 'Overwrite',
    description: 'Label for the overwrite button',
  },
  keepBothButton: {
    id: 'duplicateFileDialog.keepBothButton',
    defaultMessage: 'Keep both',
    description: 'Label for the keep both button',
  },
  okGotItButton: {
    id: 'duplicateFileDialog.okGotItButton',
    defaultMessage: 'OK, got it',
    description: 'Label for the ok got it button',
  },
});

export const boardExtensionsAttachDialogMessages = defineMessages({
  dialogCarrierTitle: {
    id: 'boardExtensionsAttachDialog.carrierTitle',
    defaultMessage: 'Attach carrier',
    description: 'Title of the attach board extensions dialog',
  },
  dialogHatTitle: {
    id: 'boardExtensionsAttachDialog.hatTitle',
    defaultMessage: 'Attach JHat',
    description: 'Title of the attach board extensions dialog',
  },
  dialogCarrierBodyTitle: {
    id: 'boardExtensionsAttachDialog.carrierBodyTitle',
    defaultMessage: 'How to attach a carrier',
    description: 'Message shown in the attach board extensions dialog',
  },
  dialogHatBodyTitle: {
    id: 'boardExtensionsAttachDialog.hatBodyTitle',
    defaultMessage: 'How to attach an Hat',
    description: 'Message shown in the attach board extensions dialog',
  },
  dialogCarrierBodyDescription: {
    id: 'boardExtensionsAttachDialog.carrierBodyDescription',
    defaultMessage:
      'To avoid issues, connect the carrier <bold>while the board is powered off.</bold>',
    description: 'Description shown in the attach board extensions dialog',
  },
  dialogCarrierBodyDescription2: {
    id: 'boardExtensionsAttachDialog.carrierBodyDescription2',
    defaultMessage:
      'If it’s not connected, unplug the board, attach the carrier, then come back here.',
    description: 'Description shown in the attach board extensions dialog',
  },
  dialogHatBodyDescription: {
    id: 'boardExtensionsAttachDialog.hatBodyDescription',
    defaultMessage:
      'To avoid issues, connect the board extensions <bold>while the board is powered off.</bold>',
    description: 'Description shown in the attach board extensions dialog',
  },
  confirmButton: {
    id: 'boardExtensionsAttachDialog.confirmButton',
    defaultMessage: 'OK, got it',
    description:
      'Label for the confirm button in the attach board extensions dialog',
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
      'This AI Model is currently linked to one or more other projects',
    description: 'Message shown in the AI model uninstall dialog',
  },
  dialogBodyDescription: {
    id: 'aiModelUninstallDialog.bodyDescription',
    defaultMessage:
      'The AI Model will be uninstalled from all linked projects. Proceed anyway?',
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
    defaultMessage: 'Keep the AI Model',
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
    defaultMessage: 'AI Model not available',
    description: 'Message shown in the AI model required dialog for apps',
  },
  dialogBodyTitleReadOnlyApp: {
    id: 'aiModelRequiredDialog.bodyTitleReadOnlyApp',
    defaultMessage: 'Download the AI Model to run this App',
    description:
      'Message shown in the AI model required dialog for read-only apps (example apps and installed releases)',
  },
  dialogBodyDescriptionApp: {
    id: 'aiModelRequiredDialog.bodyDescriptionApp',
    defaultMessage:
      'This App needs the {modelName} AI Model. Download it now to run this App or select another one.',
    description: 'Description shown in the AI model required dialog for apps',
  },
  dialogBodyDescriptionReadOnlyApp: {
    id: 'aiModelRequiredDialog.bodyDescriptionReadOnlyApp',
    defaultMessage:
      'This App needs the {modelName} AI Model. Download it now to run this App.',
    description:
      'Description shown in the AI model required dialog for read-only apps (example apps and installed releases)',
  },
  confirmButtonApp: {
    id: 'aiModelRequiredDialog.confirmButtonApp',
    defaultMessage: 'Select model',
    description:
      'Label for the confirm button in the AI model required dialog for apps',
  },
  confirmButtonReadOnlyApp: {
    id: 'aiModelRequiredDialog.confirmButtonReadOnlyApp',
    defaultMessage: 'Download model',
    description:
      'Label for the confirm button in the AI model required dialog for read-only apps (example apps and installed releases)',
  },
});

export const cloudConnectorDisconnectDialogMessages = defineMessages({
  dialogTitle: {
    id: 'cloudConnectorDisconnectDialog.title',
    defaultMessage: 'Arduino Cloud',
    description: 'Title of the cloud connector disconnect dialog',
  },
  dialogBodyTitle: {
    id: 'cloudConnectorDisconnectDialog.bodyTitle',
    defaultMessage: 'Delete this device from Arduino Cloud?',
    description: 'Message shown in the cloud connector disconnect dialog',
  },
  dialogBodyDescription: {
    id: 'cloudConnectorDisconnectDialog.bodyDescription',
    defaultMessage:
      "It will stop syncing data with Arduino Cloud, and your Apps won't be able to read or write its variables. You can connect it again any time.",
    description:
      'Description shown in the cloud connector disconnect dialog to reassure users about their work safety',
  },
  cancelButton: {
    id: 'cloudConnectorDisconnectDialog.cancelButton',
    defaultMessage: 'Cancel',
    description:
      'Label for the cancel button in the cloud connector disconnect dialog',
  },
  confirmButton: {
    id: 'cloudConnectorDisconnectDialog.confirmButton',
    defaultMessage: 'Delete',
    description:
      'Label for the confirm button in the cloud connector disconnect dialog',
  },
});

export const cloudConnectorConnectDialogMessages = defineMessages({
  dialogTitle: {
    id: 'cloudConnectorConnectDialog.title',
    defaultMessage: 'Arduino Cloud',
    description: 'Title of the cloud connector connect dialog',
  },
  dialogBodyTitle: {
    id: 'cloudConnectorConnectDialog.bodyTitle',
    defaultMessage: 'Connect device to Arduino Cloud',
    description: 'Message shown in the cloud connector connect dialog',
  },
  dialogBodyDescription: {
    id: 'cloudConnectorConnectDialog.bodyDescription',
    defaultMessage:
      'Your device will be registered with Arduino Cloud and stay connected on its own, even when no App is running. Once set up, <bold>your Apps can send and receive data from the Cloud in real time.</bold>',
    description:
      'Description shown in the cloud connector connect dialog to reassure users about their work safety',
  },
  dialogBodyDescription2: {
    id: 'cloudConnectorConnectDialog.bodyDescription2',
    defaultMessage: 'Select the Cloud space where you want to add this device.',
    description:
      'Description shown in the cloud connector connect dialog to warn users about data loss',
  },
  continueButton: {
    id: 'cloudConnectorConnectDialog.continueButton',
    defaultMessage: 'Continue',
    description:
      'Label for the continue button in the cloud connector connect dialog',
  },
  confirmButton: {
    id: 'cloudConnectorConnectDialog.confirmButton',
    defaultMessage: 'Connect device',
    description:
      'Label for the confirm button in the cloud connector connect dialog',
  },
  networkTitle: {
    id: 'cloudConnectorConnectDialog.networkTitle',
    defaultMessage: 'Network required',
    description:
      'Label for the network selection in the cloud connector connect dialog',
  },
  networkDescription: {
    id: 'cloudConnectorConnectDialog.networkDescription',
    defaultMessage:
      'Your device needs a network connection to be added to Arduino Cloud.',
    description:
      'Description shown in the cloud connector connect dialog to explain network selection',
  },
  networkButton: {
    id: 'cloudConnectorConnectDialog.networkButton',
    defaultMessage: 'Connect Wi-Fi',
    description:
      'Label for the network selection button in the cloud connector connect dialog',
  },
});

export const cloudConnectorErrorDialogMessages = defineMessages({
  dialogTitle: {
    id: 'cloudConnectorErrorDialog.title',
    defaultMessage: 'Arduino Cloud',
    description: 'Title of the cloud connector error dialog',
  },
  dialogBodyTitle: {
    id: 'cloudConnectorErrorDialog.bodyTitle',
    defaultMessage: 'Device verification failed',
    description: 'Message shown in the cloud connector error dialog',
  },
  dialogBodyDescription: {
    id: 'cloudConnectorErrorDialog.bodyDescription',
    defaultMessage:
      'The device signature is invalid. This can happen if the board was previously used or misconfigured.',
    description:
      'Description shown in the cloud connector error dialog to reassure users about their work safety',
  },
  dialogBodyDescription2: {
    id: 'cloudConnectorErrorDialog.bodyDescription2',
    defaultMessage:
      'Please contact support with the device ID below. You may need to reset the board to continue.',
    description:
      'Description shown in the cloud connector error dialog to warn users about data loss',
  },
  uhwidLabel: {
    id: 'cloudConnectorErrorDialog.uhwidLabel',
    defaultMessage: 'Unique hardware ID',
    description:
      'UHDID label shown in the cloud connector error dialog to warn users about data loss',
  },
  contactSupportButton: {
    id: 'cloudConnectorErrorDialog.contactSupportButton',
    defaultMessage: 'Contact support',
    description:
      'Label for the continue button in the cloud connector error dialog',
  },
  confirmButton: {
    id: 'cloudConnectorErrorDialog.confirmButton',
    defaultMessage: 'OK, got it',
    description:
      'Label for the confirm button in the cloud connector error dialog',
  },
});

export const cloudConnectorRequiredDialogMessages = defineMessages({
  dialogTitle: {
    id: 'cloudConnectorRequiredDialog.title',
    defaultMessage: 'Provisioning required',
    description: 'Title of the cloud connector required dialog',
  },
  dialogBodyTitle: {
    id: 'cloudConnectorRequiredDialog.bodyTitle',
    defaultMessage: 'Connect device to Arduino Cloud',
    description: 'Message shown in the cloud connector required dialog',
  },
  dialogBodyDescription: {
    id: 'cloudConnectorRequiredDialog.bodyDescription',
    defaultMessage:
      'This App uses the Arduino Cloud Brick, which needs the device connected to sync data.',
    description:
      'Description shown in the cloud connector required dialog to reassure users about their work safety',
  },
  confirmButton: {
    id: 'cloudConnectorRequiredDialog.confirmButton',
    defaultMessage: 'Connect device',
    description:
      'Label for the confirm button in the cloud connector required dialog',
  },
});

export const addHuggingFaceModelDialogMessages = defineMessages({
  dialogTitle: {
    id: 'addHuggingFaceModelDialog.title',
    defaultMessage: 'Add model',
    description: 'Title of the add model dialog',
  },
  dialogBodyTitle: {
    id: 'addHuggingFaceModelDialog.bodyTitle',
    defaultMessage: 'Add a model from Hugging Face',
    description: 'Body title of the link model dialog',
  },
  dialogBodyDescription: {
    id: 'addHuggingFaceModelDialog.bodyDescription',
    defaultMessage:
      "Paste the model URL or model ID. We'll check that it's compatible.",
    description: 'Body description of the link model dialog',
  },
  sourcePlaceholder: {
    id: 'addHuggingFaceModelDialog.sourcePlaceholder',
    defaultMessage: 'Hugging Face model URL or ID',
    description: 'Placeholder for the model source input field',
  },
  confirmButton: {
    id: 'addHuggingFaceModelDialog.confirmButton',
    defaultMessage: 'Download model',
    description: 'Label for the button to confirm linking a model by source',
  },
  sourceHint: {
    id: 'addHuggingFaceModelDialog.sourceHint',
    defaultMessage:
      'Use the format <mono>owner/model-name</mono>, or paste the full URL of the model page.',
    description:
      'Hint below the model source input. <mono> wraps the Hugging Face model ID format',
  },
  modelIdHelpToggle: {
    id: 'addHuggingFaceModelDialog.modelIdHelpToggle',
    defaultMessage: 'Where do I find the model ID?',
    description:
      'Toggle that shows or hides the steps to find a Hugging Face model ID',
  },
  modelIdHelpOpenModel: {
    id: 'addHuggingFaceModelDialog.modelIdHelpOpenModel',
    defaultMessage:
      'Go to <link>huggingface.co/models</link> and open the model you want to use.',
    description:
      'First step to find a model ID. <link> wraps the link to the Hugging Face models page',
  },
  modelIdHelpCopyId: {
    id: 'addHuggingFaceModelDialog.modelIdHelpCopyId',
    defaultMessage:
      'At the top of the page, next to the model name, click the copy icon. This copies the model ID.',
    description: 'Second step to find a model ID',
  },
  modelIdHelpCopyPointer: {
    id: 'addHuggingFaceModelDialog.modelIdHelpCopyPointer',
    defaultMessage: '← copy the model ID',
    description:
      'Label that points at the copy icon in the example of a Hugging Face model page header',
  },
  modelIdHelpUrl: {
    id: 'addHuggingFaceModelDialog.modelIdHelpUrl',
    defaultMessage:
      "You can also paste a model URL from the 'File and Versions' tab of a Hugging Face repo",
    description: 'Tells the user a model page URL also works.',
  },
  verifyingButton: {
    id: 'addHuggingFaceModelDialog.verifyingButton',
    defaultMessage: 'Verifying...',
    description:
      'Label shown next to the spinner while the model source is being verified',
  },
  alreadyDownloading: {
    id: 'addHuggingFaceModelDialog.alreadyDownloading',
    defaultMessage: 'This model is already downloading.',
    description:
      'Error shown when the pasted source names a model whose download is already running',
  },
  alreadyInstalled: {
    id: 'addHuggingFaceModelDialog.alreadyInstalled',
    defaultMessage: 'This model is already in your Brick.',
    description:
      'Error shown when the pasted source names a model the brick already has installed',
  },
  errorGeneric: {
    id: 'addHuggingFaceModelDialog.errorGeneric',
    defaultMessage: 'Couldn’t link this model. Try again.',
    description:
      'Error shown when the board refuses the model source without saying why',
  },
});

export const createReleaseIntroDialogMessages = defineMessages({
  dialogTitle: {
    id: 'createReleaseIntroDialog.dialogTitle',
    defaultMessage: 'App release',
    description: 'Title shown in the create app release intro dialog',
  },
  title: {
    id: 'createReleaseIntroDialog.title',
    defaultMessage: 'Create App release',
    description: 'Heading of the create app release intro dialog',
  },
  description: {
    id: 'createReleaseIntroDialog.description',
    defaultMessage:
      'Create a frozen, production-ready package of your App, built to run consistently across compatible devices.',
    description: 'Explains what creating a release produces',
  },
  pointDirectProduction: {
    id: 'createReleaseIntroDialog.pointDirectProduction',
    defaultMessage:
      '<strong>Direct installation:</strong> Deploy straight to other devices without any setup.',
    description: 'First use case for an app release',
  },
  pointAppLabSharing: {
    id: 'createReleaseIntroDialog.pointAppLabSharing',
    defaultMessage:
      '<strong>App Lab sharing:</strong> Publish as a run-only sample. Users can import and run it, or clone it into an editable project. Your original stays untouched.',
    description: 'Second use case for an app release',
  },
  dontShowAgain: {
    id: 'createReleaseIntroDialog.dontShowAgain',
    defaultMessage: 'Don’t show it anymore',
    description: 'Label of the checkbox that hides the intro dialog for good',
  },
  continueButton: {
    id: 'createReleaseIntroDialog.continueButton',
    defaultMessage: 'Continue',
    description: 'Label of the button that opens the release form',
  },
});

export const createReleaseDialogMessages = defineMessages({
  dialogTitle: {
    id: 'createReleaseDialog.dialogTitle',
    defaultMessage: 'App release',
    description: 'Title shown in the create app release dialog',
  },
  cancelButton: {
    id: 'createReleaseDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label of the cancel button',
  },
  confirmButton: {
    id: 'createReleaseDialog.confirmButton',
    defaultMessage: 'Save and download',
    description: 'Label of the button that starts the release build',
  },
  buildingButton: {
    id: 'createReleaseDialog.buildingButton',
    defaultMessage: 'Building…',
    description:
      'Label of the confirm button while the release copies the App, when the dialog cannot be dismissed',
  },
  optional: {
    id: 'releaseForm.optional',
    defaultMessage: '(optional)',
    description: 'Marks a release form field as not required',
  },
  labelInfo: {
    id: 'releaseForm.labelInfo',
    defaultMessage:
      'Add a label made of numbers or letters to identify this release.',
    description: 'Tooltip explaining the release label',
  },
  targetLabel: {
    id: 'releaseForm.targetLabel',
    defaultMessage: 'Target',
    description: 'Label of the board the release is built for',
  },
  includeDataInfoRunning: {
    id: 'releaseForm.includeDataInfoRunning',
    defaultMessage:
      'Turned off while the app is running — including data during a run could cause errors.',
    description:
      'Tooltip shown when the data toggle is off because the app runs',
  },
});

export const preparationRequiredDialogMessages = defineMessages({
  dialogTitle: {
    id: 'preparationRequiredDialog.dialogTitle',
    defaultMessage: 'App release',
    description: 'Title of the preparation required dialog',
  },
  title: {
    id: 'preparationRequiredDialog.title',
    defaultMessage: 'Install app dependencies',
    description:
      'Heading of the preparation required dialog, and label of the toggle that runs preparation after a release is installed',
  },
  description: {
    id: 'preparationRequiredDialog.description',
    defaultMessage:
      'Before you can run the App, you need to complete the preparation step.',
    description: 'Explains why the release cannot run yet',
  },
  networkHint: {
    id: 'preparationRequiredDialog.networkHint',
    defaultMessage:
      'An internet connection is required to complete the preparation.',
    description: 'Warns that preparation needs the network',
  },
  cancelButton: {
    id: 'preparationRequiredDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label of the button that dismisses the dialog',
  },
  startButton: {
    id: 'preparationRequiredDialog.startButton',
    defaultMessage: 'Install dependencies',
    description: 'Label of the button that starts the preparation',
  },
});

export const releaseInfoDialogMessages = defineMessages({
  dialogTitle: {
    id: 'releaseInfoDialog.dialogTitle',
    defaultMessage: 'Release info',
    description: 'Title of the dialog that shows what an installed release is',
  },
  closeButton: {
    id: 'releaseInfoDialog.closeButton',
    defaultMessage: 'Close',
    description: 'Label of the button that closes the release info dialog',
  },
});

export const buildLogDialogMessages = defineMessages({
  dialogTitle: {
    id: 'buildLogDialog.dialogTitle',
    defaultMessage: 'Build log',
    description: 'Title of the dialog that shows the log of a failed release',
  },
  copyButton: {
    id: 'buildLogDialog.copyButton',
    defaultMessage: 'Copy',
    description: 'Label of the button that copies the build log',
  },
  closeButton: {
    id: 'buildLogDialog.closeButton',
    defaultMessage: 'Close',
    description: 'Label of the button that closes the build log dialog',
  },
});
