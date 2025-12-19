import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  boardConnectionError: {
    id: 'applab.board.connection.error',
    defaultMessage:
      'Could not reach {boardName}. It might be busy or disconnected. Check cables and power, then try once more.',
    description:
      'Notification message shown when there is a board connection error',
  },
  genericBoard: {
    id: 'applab.board.generic.name',
    defaultMessage: 'the board',
    description: 'Generic name for a user board',
  },
});
