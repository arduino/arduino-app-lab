import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'app-lab.agent-mode-banner.title',
    defaultMessage: 'App Lab Agent Mode',
    description: 'Title of the agent-mode promo banner',
  },
  description: {
    id: 'app-lab.agent-mode-banner.description',
    defaultMessage:
      'Describe an app. The agent picks the right bricks, writes the code, and prepares it for your board.',
    description: 'Description of the agent-mode promo banner',
  },
  action: {
    id: 'app-lab.agent-mode-banner.action',
    defaultMessage: 'Configure',
    description: 'Label of the agent-mode promo banner call-to-action button',
  },
});
