import { defineMessages } from 'react-intl';

export const messages = defineMessages({
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
  successfullyAddedCustomBrick: {
    id: 'app-detail.successfully-added-custom-brick',
    defaultMessage: 'Brick created. You can now start building with it.',
    description: 'Notification message shown when a custom brick is created',
  },
  failedAddCustomBrick: {
    id: 'app-detail.failed-add-custom-brick',
    defaultMessage: 'Failed to create brick',
    description: 'Notification message shown when brick creation fails',
  },
  updateAppLab: {
    id: 'app-detail.update-app-lab',
    defaultMessage: 'Update App Lab in Settings to create custom Bricks.',
    description: 'Button text to update the App Lab version',
  },
  successfullyRenamedBrick: {
    id: 'app-detail.successfully-renamed-brick',
    defaultMessage: 'Brick renamed successfully',
    description: 'Notification message shown when a brick is renamed',
  },
  failedRenameBrick: {
    id: 'app-detail.failed-rename-brick',
    defaultMessage: 'Failed to rename brick',
    description: 'Notification message shown when brick rename fails',
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
  failedCreateFileStorageFull: {
    id: 'app-detail.failed-create-file-storage-full',
    defaultMessage: 'Failed to create file. The board storage is full.',
    description:
      'Notification message shown when file creation fails due to full storage',
  },
  fileAlreadyExists: {
    id: 'app-detail.file-already-exists',
    defaultMessage: 'A file with this name already exists',
    description:
      'Notification message shown when trying to create a file with duplicate name',
  },
  fileAlreadyExistsFolder: {
    id: 'app-detail.file-already-exists-folder',
    defaultMessage:
      "Can't create this file. A folder with the same name already exists.",
    description:
      'Notification message shown when trying to create a file with a folder of the same name',
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
  failedCreateFolderStorageFull: {
    id: 'app-detail.failed-create-folder-storage-full',
    defaultMessage: 'Failed to create folder. The board storage is full.',
    description:
      'Notification message shown when folder creation fails due to full storage',
  },
  folderAlreadyExists: {
    id: 'app-detail.folder-already-exists',
    defaultMessage: 'A folder with this name already exists',
    description:
      'Notification message shown when trying to create a folder with duplicate name',
  },
  folderAlreadyExistsFile: {
    id: 'app-detail.folder-already-exists-file',
    defaultMessage:
      "Can't create this folder. A file with the same name already exists.",
    description:
      'Notification message shown when trying to create a folder with a file of the same name',
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
  successfullyRenamedFolder: {
    id: 'app-detail.successfully-renamed-folder',
    defaultMessage: 'Folder renamed successfully',
    description: 'Notification message shown when a folder is renamed',
  },
  failedRenameFolder: {
    id: 'app-detail.failed-rename-folder',
    defaultMessage: 'Failed to rename folder',
    description: 'Notification message shown when folder rename fails',
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
  successfullyDeletedFolder: {
    id: 'app-detail.successfully-deleted-folder',
    defaultMessage: 'Folder deleted successfully',
    description: 'Notification message shown when a folder is deleted',
  },
  failedDeleteFolder: {
    id: 'app-detail.failed-delete-folder',
    defaultMessage: 'Failed to delete folder',
    description: 'Notification message shown when folder deletion fails',
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
  fileCannotBeMoved: {
    id: 'app-detail.file-cannot-be-moved',
    defaultMessage:
      'File cannot be moved, doing so violates the Arduino App specification',
    description:
      'Notification shown when the user attempts to move a file or folder that the Arduino App specification protects (e.g. app.yaml, sketch/sketch.ino, the python folder).',
  },
  webUIFileCreationFailed: {
    id: 'app-detail.webui-file-creation-failed',
    defaultMessage:
      'Failed to create WebUI files. Please create them manually.',
    description:
      'Notification message shown when automatic WebUI file creation fails',
  },
});
