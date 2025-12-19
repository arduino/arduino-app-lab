import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  replace: {
    id: 'findAndReplace.replace',
    defaultMessage: 'Replace',
    description: 'Replace',
  },
  replaceAll: {
    id: 'findAndReplace.replaceAll',
    defaultMessage: 'Replace All',
    description: 'Replace All',
  },
  selectAll: {
    id: 'findAndReplace.selectAll',
    defaultMessage: 'Select All',
    description: 'Select All',
  },
  prev: {
    id: 'findAndReplace.prev',
    defaultMessage: 'Previous',
    description: 'Previous',
  },
  next: {
    id: 'findAndReplace.next',
    defaultMessage: 'Next',
    description: 'Next',
  },
  occurrences: {
    id: 'findAndReplace.occurrences',
    defaultMessage: '{currentMatch} of {totalOccurrences}',
    description: '{currentMatch} of {totalOccurrences}',
  },
  noResults: {
    id: 'findAndReplace.noResults',
    defaultMessage: 'No results',
    description: 'No results',
  },
});
