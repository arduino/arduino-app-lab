import { defineMessages } from 'react-intl';

import { NewTabMenuItemIds, TabMenuItemIds } from '../EditorTabsBar.type';

export const commandMessages = defineMessages<keyof typeof TabMenuItemIds>({
  [TabMenuItemIds.Close]: {
    id: 'tabMenu.close',
    defaultMessage: 'Close',
    description: 'Close',
  },
  [TabMenuItemIds.CloseOthers]: {
    id: 'tabMenu.closeOthers',
    defaultMessage: 'Close Others',
    description: 'Close Others',
  },
  [TabMenuItemIds.CloseToTheLeft]: {
    id: 'tabMenu.closeToTheLeft',
    defaultMessage: 'Close to the Left',
    description: 'Close to the Left',
  },
  [TabMenuItemIds.CloseToTheRight]: {
    id: 'tabMenu.closeToTheRight',
    defaultMessage: 'Close to the Right',
    description: 'Close to the Right',
  },
  [TabMenuItemIds.CloseAll]: {
    id: 'tabMenu.closeAll',
    defaultMessage: 'Close All',
    description: 'Close All',
  },
  [TabMenuItemIds.SplitRight]: {
    id: 'tabMenu.splitRight',
    defaultMessage: 'Split Right',
    description: 'Open the file in a split editor on the right',
  },
  [TabMenuItemIds.SplitLeft]: {
    id: 'tabMenu.splitLeft',
    defaultMessage: 'Split Left',
    description: 'Open the file in a split editor on the left',
  },
  [TabMenuItemIds.RenameFile]: {
    id: 'tabMenu.rename',
    defaultMessage: 'Rename',
    description: 'Rename',
  },
  [TabMenuItemIds.DeleteFile]: {
    id: 'tabMenu.deleteFile',
    defaultMessage: 'Delete File',
    description: 'Delete File',
  },
});

export const newTabCommandMessages = defineMessages<
  keyof typeof NewTabMenuItemIds
>({
  [NewTabMenuItemIds.AddSketchFile]: {
    id: 'newTabMenu.addSketchFile',
    defaultMessage: 'Add Sketch File',
    description: 'Add Sketch File',
  },
  [NewTabMenuItemIds.AddHeaderFile]: {
    id: 'newTabMenu.addHeaderFile',
    defaultMessage: 'Add Header File',
    description: 'Add Header File',
  },
  [NewTabMenuItemIds.AddTextFile]: {
    id: 'newTabMenu.addTextFile',
    defaultMessage: 'Add Text File',
    description: 'Add Text File',
  },
  [NewTabMenuItemIds.AddSecretsTab]: {
    id: 'newTabMenu.addSecretsTab',
    defaultMessage: 'Add Secrets Tab',
    description: 'Add Secrets Tab',
  },
  [NewTabMenuItemIds.ImportFile]: {
    id: 'newTabMenu.importFile',
    defaultMessage: 'Import File',
    description: 'Import File',
  },
});

export const messages = defineMessages({
  deleteFileDialogTitle: {
    id: 'deleteFileDialog.title',
    defaultMessage: 'Delete File',
    description: 'Title shown in the delete file dialog',
  },
  deleteFileDialogCancelButton: {
    id: 'deleteFileDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  deleteFileDialogConfirmButton: {
    id: 'deleteFileDialog.confirmButton',
    defaultMessage: 'Yes, Delete',
    description: 'Label for the confirm button',
  },
  deleteFileDialogConfirmMessage: {
    id: 'deleteFileDialog.confirmMessage',
    defaultMessage:
      'This action is irreversible. Are you sure you want to delete this file?',
    description: 'Message to confirm the deletion of a file',
  },
  deleteFileDialogMessage: {
    id: 'deleteFileDialog.message',
    defaultMessage: 'Delete',
    description: 'Message shown in the delete file dialog',
  },
  deleteFileDialogMessageName: {
    id: 'deleteFileDialog.messageName',
    defaultMessage: '{fileFullName}',
    description: 'Name of the file to be deleted',
  },
});
