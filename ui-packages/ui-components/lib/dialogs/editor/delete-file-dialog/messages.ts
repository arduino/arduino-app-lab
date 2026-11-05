import { defineMessages } from 'react-intl';

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
