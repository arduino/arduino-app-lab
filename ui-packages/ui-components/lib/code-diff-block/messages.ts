import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  goToError: {
    id: 'genai.go-to-error',
    defaultMessage: 'Go to error',
    description: 'Go to error button',
  },
  applyFix: {
    id: 'genai.apply-fix',
    defaultMessage: 'Apply Fix',
    description: 'Apply Fix error button',
  },
  errorNotFixedInCode: {
    id: 'genai.error-not-fixed-in-code',
    defaultMessage: 'Fix incompatible or already included',
    description: 'Advisory given to user when error is not fixed in code',
  },
});
