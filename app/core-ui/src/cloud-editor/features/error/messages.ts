import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  needHelpMessage: {
    id: 'error.needHelpMessage',
    defaultMessage: '{getInTouchLink} with us',
    description: 'Help msg for error page',
  },
  getInTouchLink: {
    id: 'error.getInTouchLink',
    defaultMessage: 'Get in touch',
    description: 'Link to get in touch',
  },
  helpTitle: {
    id: 'error.helpTitle',
    defaultMessage: 'An Error Occurred',
    description: 'Title for error page',
  },
  helpMessage: {
    id: 'error.helpMessage',
    defaultMessage: "We're not sure what happened",
    description: 'Help msg for error page',
  },
  copyError: {
    id: 'error.copyError',
    defaultMessage: 'Copy Error to Clipboard',
    description: 'CTA to copy error to clipboard',
  },
});
