import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  readOnlyBanner: {
    id: 'editor.read-only-banner',
    defaultMessage:
      ' Read-only code. Create your own app from this example to edit.',
    description: 'Label for the read only banner in the editor panel',
  },
  readOnlyAttempt: {
    id: 'editor.read-only-attempt',
    defaultMessage: 'This file is view-only and can’t be edited.',
    description: 'Message shown when user tries to edit a read-only file',
  },
  noExtensionHint: {
    id: 'editor.no-extension-hint',
    defaultMessage:
      'Use a file extension like .py or .ino to enable syntax highlighting',
    description:
      'Message shown when a file with no extension is opened, so no language can be inferred for highlighting',
  },
});
