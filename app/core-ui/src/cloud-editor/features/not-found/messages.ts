import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  needHelpMessage: {
    id: 'notFound.needHelpMessage',
    defaultMessage: 'Need help? {getInTouchLink} with us',
    description: 'Help msg for error page',
  },
  getInTouchLink: {
    id: 'notFound.getInTouchLink',
    defaultMessage: 'Get in touch',
    description: 'Link to get in touch',
  },
  helpTitle: {
    id: 'notFound.helpTitle',
    defaultMessage: '{type} not found',
    description: 'Title for error page',
  },
  helpMessage: {
    id: 'notFound.helpMessage',
    defaultMessage:
      'Unfortunately, we can’t find the {type} that you are looking for',
    description: 'Help msg for error page',
  },
  goToSketches: {
    id: 'notFound.goToSketches',
    defaultMessage: 'Go to sketches',
    description: 'CTA to go to sketch list',
  },
});
