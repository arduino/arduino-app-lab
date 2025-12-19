import { defineMessages } from 'react-intl';

export const genAiBannerMessages = defineMessages({
  genAiBannerTitle: {
    id: 'genAiBanner.title',
    defaultMessage: 'Welcome to the AI Assistant in Arduino Cloud Editor! 🤖✨',
    description: 'Title of the Arduino AI Assistant banner',
  },
  genAiBannerFreeDescription: {
    id: 'genAiBanner.description',
    defaultMessage:
      'The Arduino AI Assistant is here to help you code faster and smarter. Enjoy {limit} and share your feedback!',
    description: 'Description of the Arduino AI Assistant banner',
  },
  genAiBannerFreeLimit: {
    id: 'genAiBanner.freeLimit',
    defaultMessage: '50 free messages per month',
    description: 'Free limit for the Arduino AI Assistant banner',
  },
  genAiBannerMakerDescription: {
    id: 'genAiBanner.makerDescription',
    defaultMessage:
      'The Arduino AI Assistant is here to help you code faster and smarter. With your paid plan, you can send {limit} Give it a try and let us know what you think!',
    description: 'Description of the Arduino AI Assistant banner for MKR users',
  },
  genAiBannerMakerLimit: {
    id: 'genAiBanner.makerLimit',
    defaultMessage: '1500 messages per month.',
    description: 'Maker limit for the Arduino AI Assistant banner',
  },
  genAiBannerProDescription: {
    id: 'genAiBanner.proDescription',
    defaultMessage:
      'The Arduino AI Assistant is here to help you code faster and smarter. With your paid plan, you can send {limit} Give it a try and let us know what you think!',
    description: 'Description of the Arduino AI Assistant banner for PRO users',
  },
  genAiBannerProLimit: {
    id: 'genAiBanner.proLimit',
    defaultMessage: 'unlimited messages per day.',
    description: 'Pro limit for the Arduino AI Assistant banner',
  },
  genAiBannerMaybeLaterButton: {
    id: 'genAiBanner.maybeLaterButton',
    defaultMessage: 'Maybe later',
    description: 'Button to hide the AI Assistant banner',
  },
  genAiBannerTryItNowButton: {
    id: 'genAiBanner.tryItNowButton',
    defaultMessage: 'Try it now',
    description: 'Button to try the AI Assistant banner',
  },
});
