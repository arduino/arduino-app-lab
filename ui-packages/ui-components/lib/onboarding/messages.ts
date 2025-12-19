import { defineMessages } from 'react-intl';

export const onboardingMessages = defineMessages({
  onboardingTitle: {
    id: 'onboardingWindow.title',
    defaultMessage: 'Welcome to Your New Sketch Workspace',
    description: 'Title of the onboarding window',
  },
  onboardingDescription: {
    id: 'onboardingWindow.description',
    defaultMessage:
      "You've just opened a sketch, named {sketchName}, awaiting your unique touch. This is where your Arduino ideas will take shape.",
    description: 'Description of the onboarding window',
  },
  onboardingHideButton: {
    id: 'onboardingWindow.hideButton',
    defaultMessage: 'Hide',
    description: 'Button to hide the onboarding window',
  },
  onboardingStartButton: {
    id: 'onboardingWindow.startButton',
    defaultMessage: 'Start Tour',
    description: 'Button to start the onboarding',
  },
});

export const onboardingStepsMessages = defineMessages({
  connectDeviceTitle: {
    id: 'onboardingSteps.connectDeviceTitle',
    defaultMessage: 'Connect your device',
    description: 'Title of the connect device step',
  },
  connectDeviceContent: {
    id: 'onboardingSteps.connectDeviceContent',
    defaultMessage:
      'Start connecting your device or choosing a device type to start coding.',
    description: 'Content of the connect device step',
  },
  verifyAndUploadTitle: {
    id: 'onboardingSteps.verifyAndUploadTitle',
    defaultMessage: 'Verify and upload With Ease',
    description: 'Title of the verify and upload step',
  },
  verifyAndUploadContent: {
    id: 'onboardingSteps.verifyAndUploadContent',
    defaultMessage:
      "Make sure your code is error-free with 'Verify' or directly 'Upload' it to your board and watch the magic happen!",
    description: 'Content of the verify and upload step',
  },
  deviceInteractionTitle: {
    id: 'onboardingSteps.deviceInteractionTitle',
    defaultMessage: 'Device real-time interactions',
    description: 'Title of the device interaction step',
  },
  deviceInteractionContent: {
    id: 'onboardingSteps.deviceInteractionContent',
    defaultMessage:
      'Engage in direct communication with your hardware using real-time data exchange via the Serial Monitor.',
    description: 'Content of the device interaction step',
  },
  examplesTitle: {
    id: 'onboardingSteps.examplesTitle',
    defaultMessage: 'Get inspired with Examples',
    description: 'Title of the examples step',
  },
  examplesContent: {
    id: 'onboardingSteps.examplesContent',
    defaultMessage:
      "Not sure where to start? Browse and select from a variety of examples that fit your project's needs or to get inspired.",
    description: 'Content of the examples step',
  },
  librariesAndLanguageTitle: {
    id: 'onboardingSteps.librariesAndLanguageTitle',
    defaultMessage: 'Libraries and Language Reference',
    description: 'Title of the libraries and languages step',
  },
  librariesAndLanguageContent: {
    id: 'onboardingSteps.librariesAndLanguageContent',
    defaultMessage:
      'Access a wealth of resources with Arduino libraries and get familiar with coding fundamentals using the Language Reference.',
    description: 'Content of the libraries and languages step',
  },
  sketchCollectionTitle: {
    id: 'onboardingSteps.sketchCollectionTitle',
    defaultMessage: 'Back to Your Sketch Collection',
    description: 'Title of the sketch collection step',
  },
  sketchCollectionContent: {
    id: 'onboardingSteps.sketchCollectionContent',
    defaultMessage:
      'Use the navigation to switch between the Arduino Cloud features and to conveniently access the full collection of your sketches',
    description: 'Content of the sketch collection step',
  },
  finishTour: {
    id: 'onboardingSteps.finishTour',
    defaultMessage: 'Finish Tour',
    description: 'Button to finish the onboarding',
  },
  skipAll: {
    id: 'onboardingSteps.skipAll',
    defaultMessage: 'Skip All',
    description: 'Button to skip all the steps',
  },
});
