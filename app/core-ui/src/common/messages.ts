import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  exampleModificationAdvisory: {
    id: 'example-mod-advisory',
    defaultMessage:
      'Examples cannot be modified, you can make a copy and do your changes there.',
    description: 'Advisory given to user when example is modified',
  },
  exampleModificationCopy: {
    id: 'example-mod-advisory-action',
    defaultMessage: 'COPY IN YOUR SKETCHES',
    description: 'Action given to user when example is modified',
  },
  successfulLibraryInclude: {
    id: 'include-library-success',
    defaultMessage: 'Library included',
    description: 'Advisory given to user when library is included',
  },
  libraryAlreadyIncluded: {
    id: 'include-library-already-included',
    defaultMessage: 'Library already included',
    description: 'Advisory given to user when library is already included',
  },
  errorFixedInCode: {
    id: 'error-fixed-in-code',
    defaultMessage: 'Error fixed in code',
    description: 'Advisory given to user when error is fixed in code',
  },
  fixAlreadyIncluded: {
    id: 'fix-already-included',
    defaultMessage: 'Fix already included',
    description: 'Advisory given to user when fix is already included',
  },
});
