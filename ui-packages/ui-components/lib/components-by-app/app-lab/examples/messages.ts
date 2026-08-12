import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  examplesCount: {
    id: 'appLabExamples.count',
    defaultMessage: '{count, plural, one {# example} other {# examples}}',
    description: 'Badge showing the number of examples in a section',
  },
  emptyTitle: {
    id: 'appLabExamples.emptyTitle',
    defaultMessage: 'No examples found',
    description: 'Title shown when there are no examples to display',
  },
  emptyDescription: {
    id: 'appLabExamples.emptyDescription',
    defaultMessage:
      'There might be an issue with retrieving examples from the board',
    description: 'Description shown when there are no examples to display',
  },
});
