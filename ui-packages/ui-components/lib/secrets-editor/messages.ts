/* eslint-disable formatjs/enforce-description */
import { defineMessages } from 'react-intl';

export default defineMessages({
  header: {
    id: 'secretsEditor.header',
    defaultMessage: 'Hide your sensitive data',
  },
  description: {
    id: 'secretsEditor.description',
    defaultMessage:
      'You can use Secrets to hide sensitive data (passwords, API keys, etc.) so that they are not publicly displayed when you share your Sketches. A secret consists of a Key, the part that remains visible when the Sketch is shared, and a Value, visible only to the user who created the Sketch.',
  },
  addButton: {
    id: 'secretsEditor.addButton',
    defaultMessage: 'Add new',
  },
  removeButton: {
    id: 'secretsEditor.removeButton',
    defaultMessage: 'Delete',
  },
  keyLabel: {
    id: 'secretsEditor.keyLabel',
    defaultMessage: 'Key',
  },
  valueLabel: {
    id: 'secretsEditor.valueLabel',
    defaultMessage: 'Value',
  },
  duplicateError: {
    id: 'secretsEditor.duplicateError',
    defaultMessage: 'Duplicate key. Please choose a unique one.',
  },
});

export const deleteSecretDialogMessages = defineMessages({
  dialogTitle: {
    id: 'deleteSecretDialog.title',
    defaultMessage: 'Delete secret',
  },
  actionTitle: {
    id: 'deleteSecretDialog.actionTitle',
    defaultMessage: 'Delete ',
  },
  actionDescription: {
    id: 'deleteSecretDialog.actionDescription',
    defaultMessage:
      'This action is irreversible. Are you sure you want to delete this secret?',
  },
  warningDescription: {
    id: 'deleteSecretDialog.warningDescription',
    defaultMessage:
      'Please note that deleting the secret will render the associated keys in the sketch files non-functional. You will need to manually remove them from the code.',
  },
  deleteButton: {
    id: 'deleteSecretDialog.deleteButton',
    defaultMessage: 'Yes, delete',
  },
  cancelButton: {
    id: 'deleteSecretDialog.cancelButton',
    defaultMessage: 'Cancel',
  },
});
