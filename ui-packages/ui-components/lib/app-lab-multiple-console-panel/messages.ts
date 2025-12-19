import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  description: {
    id: 'appLabMultipleConsolePanel.description',
    defaultMessage: 'Run the app to start generating logs',
    description: 'Description for the multiple console panel',
  },
  sendMessagePlaceholder: {
    id: 'appLabMultipleConsolePanel.sendMessagePlaceholder',
    defaultMessage:
      'Message (Enter to send a message to “{name}” on {address})',
    description: 'Placeholder text for the send message input',
  },
  sendMessageNoBoardPlaceholder: {
    id: 'appLabMultipleConsolePanel.sendMessageNoBoardPlaceholder',
    defaultMessage: 'Message (Enter to send a message to your board)',
    description:
      'Placeholder text for the send message input when no boards are available yet',
  },
});
