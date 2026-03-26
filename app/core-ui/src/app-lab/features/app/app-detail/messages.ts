import { defineMessages } from 'react-intl';

export const appFilesMessages = defineMessages({
  bricksLabel: {
    id: 'app-files-section.bricks-label',
    defaultMessage: 'Bricks',
    description: 'Label for the Bricks section in the App Files Section',
  },
  sketchLibrariesLabel: {
    id: 'app-files-section.sketch-libraries-label',
    defaultMessage: 'Sketch Libraries',
    description:
      'Label for the Sketch Libraries section in the App Files Section',
  },
  filesLabel: {
    id: 'app-files-section.files-label',
    defaultMessage: 'Files',
    description: 'Label for the Files section in the App Files Section',
  },
  addBrickButton: {
    id: 'app-files-section.add-brick-button',
    defaultMessage: 'Add Brick',
    description: 'Button text to add a new brick to the app',
  },
  addSketchLibraryButton: {
    id: 'app-files-section.add-sketch-library-button',
    defaultMessage: 'Add Sketch Library',
    description: 'Button text to add a new sketch library to the app',
  },
  addFileButton: {
    id: 'app-files-section.add-file-button',
    defaultMessage: 'Add File',
    description: 'Button text to add a new file to the app',
  },
  noBricksAddedYet: {
    id: 'app-files-section.no-bricks-added-yet',
    defaultMessage: 'No bricks added yet',
    description: 'Message shown when there are no bricks added to the app',
  },
  noSketchLibrariesAddedYet: {
    id: 'app-files-section.no-sketch-libraries-added-yet',
    defaultMessage: 'No sketch libraries added yet',
    description:
      'Message shown when there are no sketch libraries added to the app',
  },
});

export const appDetailMessages = defineMessages({
  copyAndEditButton: {
    id: 'app-detail.copy-and-edit-button',
    defaultMessage: 'Copy and edit app',
    description: 'Button text to copy and edit an example app',
  },
  successfullyDuplicatedApp: {
    id: 'app-detail.successfully-duplicated-app',
    defaultMessage: 'App duplicated successfully',
    description: 'Notification message shown when an app is duplicated',
  },
  failedDuplicateApp: {
    id: 'app-detail.failed-duplicate-app',
    defaultMessage: 'Failed to duplicate app',
    description: 'Notification message shown when app duplication fails',
  },
  successfullyDeletedApp: {
    id: 'app-detail.successfully-deleted-app',
    defaultMessage: 'App deleted successfully',
    description: 'Notification message shown when an app is deleted',
  },
  failedDeleteApp: {
    id: 'app-detail.failed-delete-app',
    defaultMessage: 'Failed to delete app',
    description: 'Notification message shown when app deletion fails',
  },
  successfullyAddedBrick: {
    id: 'app-detail.successfully-added-brick',
    defaultMessage: 'Brick added successfully',
    description: 'Notification message shown when a brick is added',
  },
  failedAddBrick: {
    id: 'app-detail.failed-add-brick',
    defaultMessage: 'Failed to add brick',
    description: 'Notification message shown when brick addition fails',
  },
  successfullyDeletedBrick: {
    id: 'app-detail.successfully-deleted-brick',
    defaultMessage: 'Brick deleted successfully',
    description: 'Notification message shown when a brick is deleted',
  },
  failedDeleteBrick: {
    id: 'app-detail.failed-delete-brick',
    defaultMessage: 'Failed to delete brick',
    description: 'Notification message shown when brick deletion fails',
  },
  successfullyAddedLibrary: {
    id: 'app-detail.successfully-added-library',
    defaultMessage: 'Library added successfully',
    description: 'Notification message shown when a library is added',
  },
  failedAddLibrary: {
    id: 'app-detail.failed-add-library',
    defaultMessage: 'Failed to add library',
    description: 'Notification message shown when library addition fails',
  },
  successfullyDeletedLibrary: {
    id: 'app-detail.successfully-deleted-library',
    defaultMessage: 'Library deleted successfully',
    description: 'Notification message shown when a library is deleted',
  },
  failedDeleteLibrary: {
    id: 'app-detail.failed-delete-library',
    defaultMessage: 'Failed to delete library',
    description: 'Notification message shown when library deletion fails',
  },
  successfullyCreatedFile: {
    id: 'app-detail.successfully-created-file',
    defaultMessage: 'File created successfully',
    description: 'Notification message shown when a file is created',
  },
  failedCreateFile: {
    id: 'app-detail.failed-create-file',
    defaultMessage: 'Failed to create file',
    description: 'Notification message shown when file creation fails',
  },
  fileAlreadyExists: {
    id: 'app-detail.file-already-exists',
    defaultMessage: 'A file with this name already exists',
    description:
      'Notification message shown when trying to create a file with duplicate name',
  },
  successfullyCreatedFolder: {
    id: 'app-detail.successfully-created-folder',
    defaultMessage: 'Folder created successfully',
    description: 'Notification message shown when a folder is created',
  },
  failedCreateFolder: {
    id: 'app-detail.failed-create-folder',
    defaultMessage: 'Failed to create folder',
    description: 'Notification message shown when folder creation fails',
  },
  folderAlreadyExists: {
    id: 'app-detail.folder-already-exists',
    defaultMessage: 'A folder with this name already exists',
    description:
      'Notification message shown when trying to create a folder with duplicate name',
  },
  successfullyRenamedFile: {
    id: 'app-detail.successfully-renamed-file',
    defaultMessage: 'File renamed successfully',
    description: 'Notification message shown when a file is renamed',
  },
  failedRenameFile: {
    id: 'app-detail.failed-rename-file',
    defaultMessage: 'Failed to rename file',
    description: 'Notification message shown when file rename fails',
  },
  fileAlreadyExistsRename: {
    id: 'app-detail.file-already-exists-rename',
    defaultMessage: 'A file with this name already exists',
    description:
      'Notification message shown when trying to rename a file with duplicate name',
  },
  folderAlreadyExistsRename: {
    id: 'app-detail.folder-already-exists-rename',
    defaultMessage: 'A folder with this name already exists',
    description:
      'Notification message shown when trying to rename a folder with duplicate name',
  },
  successfullyDeletedFile: {
    id: 'app-detail.successfully-deleted-file',
    defaultMessage: 'File deleted successfully',
    description: 'Notification message shown when a file is deleted',
  },
  failedDeleteFile: {
    id: 'app-detail.failed-delete-file',
    defaultMessage: 'Failed to delete file',
    description: 'Notification message shown when file deletion fails',
  },
  appIsRunning: {
    id: 'app-detail.app-is-running',
    defaultMessage: 'App is now running',
    description: 'Notification message shown when the app starts running',
  },
  appIsStopped: {
    id: 'app-detail.app-is-stopped',
    defaultMessage: 'App is now stopped',
    description: 'Notification message shown when the app stops running',
  },
  codeCopied: {
    id: 'app-detail.code-copied',
    defaultMessage: 'Code copied to clipboard',
    description: 'Notification message shown when code is copied to clipboard',
  },
});
