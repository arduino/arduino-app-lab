import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'app-lab.app-welcome-dialog.title',
    defaultMessage: 'Welcome to Arduino App Lab',
    description: 'Title shown on the app welcome dialog',
  },
  contentTitle: {
    id: 'app-lab.app-welcome-dialog.content-title',
    defaultMessage: "Ready to Build? Explore App Lab's Core Concepts",
    description: 'Main content title in the welcome dialog',
  },
  confirmButton: {
    id: 'app-lab.app-welcome-dialog.confirm-button',
    defaultMessage: 'Ok, got it',
    description: 'Text for the confirmation button',
  },
  appsTitle: {
    id: 'app-lab.app-welcome-dialog.features.apps.title',
    defaultMessage: 'Apps',
    description: 'Feature title for Apps section',
  },
  appsDescription: {
    id: 'app-lab.app-welcome-dialog.features.apps.description',
    defaultMessage:
      'Now you can build apps that seamlessly blend Python on Linux with C as a Sketch.',
    description: 'Feature description for Apps section',
  },
  bricksTitle: {
    id: 'app-lab.app-welcome-dialog.features.brick.title',
    defaultMessage: 'Bricks',
    description: 'Feature title for Bricks section',
  },
  bricksDescription: {
    id: 'app-lab.app-welcome-dialog.features.brick.description',
    defaultMessage:
      'Ready-to-use components that handle everything from AI-powered computer vision, audio and data storage. Just add them into your project to unlock powerful functionalities.',
    description: 'Feature description for Bricks section',
  },
  examplesTitle: {
    id: 'app-lab.app-welcome-dialog.features.examples.title',
    defaultMessage: 'Examples',
    description: 'Feature title for Examples section',
  },
  examplesDescription: {
    id: 'app-lab.app-welcome-dialog.features.examples.description',
    defaultMessage:
      'The perfect starting point for beginners. Each example is a simple app that shows you how to combine Bricks to get powerful results with just a few lines of code.',
    description: 'Feature description for Examples section',
  },
});
